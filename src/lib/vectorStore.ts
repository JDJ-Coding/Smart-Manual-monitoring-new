import fs from "fs";
import path from "path";
import type { VectorStore, TextChunk, SearchResult } from "@/types";
import { buildBM25Index, searchBM25, type BM25Index } from "./bm25";

const STORE_PATH = path.join(process.cwd(), "data", "vector-store", "index.json");

let _cache: VectorStore | null = null;
let _bm25Index: BM25Index | null = null;

// LRU Map: 파일명별 BM25 서브인덱스 캐시 (최대 20개)
class LRUMap<K, V> extends Map<K, V> {
  constructor(private maxSize: number) { super(); }
  set(key: K, value: V): this {
    if (this.size >= this.maxSize) {
      this.delete(this.keys().next().value as K);
    }
    return super.set(key, value);
  }
}
const _bm25FilterCache = new LRUMap<string, BM25Index>(20);

export function loadVectorStore(): VectorStore | null {
  if (_cache) return _cache;
  if (!fs.existsSync(STORE_PATH)) return null;

  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    _cache = JSON.parse(raw) as VectorStore;
    // BM25 인덱스를 로드 시점에 인메모리로 빌드
    _bm25Index = buildBM25Index(_cache.chunks.map((c) => c.text));
    return _cache;
  } catch {
    return null;
  }
}

export function saveVectorStore(store: VectorStore): void {
  const dir = path.dirname(STORE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store), "utf-8");
  _cache = store;
  // 저장 후 BM25 인덱스 갱신 + 필터 캐시 초기화
  _bm25Index = buildBM25Index(store.chunks.map((c) => c.text));
  _bm25FilterCache.clear();
}

export function clearVectorStoreCache(): void {
  _cache = null;
  _bm25Index = null;
  _bm25FilterCache.clear();
}

// 정규화된 임베딩의 코사인 유사도 = 내적 (Float32Array로 최적화)
const _float32Cache = new Map<number[], Float32Array>();

function toFloat32(arr: number[]): Float32Array {
  let cached = _float32Cache.get(arr);
  if (!cached) {
    cached = new Float32Array(arr);
    _float32Cache.set(arr, cached);
  }
  return cached;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  const aArr = toFloat32(a);
  const bArr = toFloat32(b);
  let dot = 0;
  for (let i = 0, len = aArr.length; i < len; i++) {
    dot += aArr[i] * bArr[i];
  }
  return dot;
}

export interface SearchOptions {
  k?: number;
  filterFilename?: string;
}

/**
 * 하이브리드 검색: 코사인 유사도 + BM25, Reciprocal Rank Fusion (RRF)으로 통합
 *
 * RRF 공식: score = 1/(rank_cosine + 60) + 1/(rank_bm25 + 60)
 */
export function searchVectorStore(
  queryEmbedding: number[],
  options: SearchOptions = {},
  queryText?: string
): SearchResult[] {
  const store = loadVectorStore();
  if (!store || store.chunks.length === 0) return [];

  const { k = 10, filterFilename } = options;

  // 파일 필터 적용
  let candidates = store.chunks;
  let candidateIndices: number[] = store.chunks.map((_, i) => i);

  if (filterFilename) {
    const filtered: TextChunk[] = [];
    const filteredIndices: number[] = [];
    store.chunks.forEach((c, i) => {
      if (c.metadata.filename === filterFilename) {
        filtered.push(c);
        filteredIndices.push(i);
      }
    });
    candidates = filtered;
    candidateIndices = filteredIndices;
  }

  if (candidates.length === 0) return [];

  // ── 1) 코사인 유사도 Top-20 ──────────────────────────────────────────────
  const cosineResults = candidates
    .map((chunk, localIdx) => ({
      localIdx,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // ── 2) BM25 Top-20 (queryText가 없으면 코사인만 사용) ───────────────────
  const bm25Map = new Map<number, number>(); // localIdx → bm25Rank (0-based)

  if (queryText && _bm25Index) {
    // BM25 인덱스는 전체 chunks 기준이므로 candidateIndices로 매핑
    // 필터된 경우 서브인덱스 빌드 (캐시 적용)
    let subIndex = _bm25Index;

    if (filterFilename) {
      if (!_bm25FilterCache.has(filterFilename)) {
        _bm25FilterCache.set(
          filterFilename,
          buildBM25Index(candidates.map((c) => c.text))
        );
      }
      subIndex = _bm25FilterCache.get(filterFilename)!;
    }

    const bm25Results = searchBM25(queryText, subIndex, 20);
    bm25Results.forEach(({ docIndex }, rank) => {
      bm25Map.set(docIndex, rank);
    });
  }

  // ── 3) RRF 통합 ─────────────────────────────────────────────────────────
  const RRF_K = 60;
  const rrfScores = new Map<number, { rrfScore: number; cosineScore: number }>();

  cosineResults.forEach(({ localIdx, score }, rank) => {
    const rrf = 1 / (rank + RRF_K);
    rrfScores.set(localIdx, { rrfScore: rrf, cosineScore: score });
  });

  bm25Map.forEach((rank, localIdx) => {
    const rrf = 1 / (rank + RRF_K);
    const existing = rrfScores.get(localIdx);
    if (existing) {
      existing.rrfScore += rrf;
    } else {
      rrfScores.set(localIdx, { rrfScore: rrf, cosineScore: 0 });
    }
  });

  // ── 4) 알람 관련 청크 부스팅 (알람 코드 포함 쿼리에서 1.5x) ─────────────
  // 기존 패턴(E.OC1, F0001 등) + 공백 구분 패턴("알람 13", "alarm 13") 모두 감지
  const hasAlarmPattern = queryText
    ? /\b[A-Z]{1,4}[.\-][A-Z0-9]{1,8}\b|\b[EFALWSCGB]\d{3,6}\b|\bALM-?\d+\b/i.test(queryText) ||
      /(?:알람|경보|alarm|alm|에러|error|fault)\s*\d+/i.test(queryText)
    : false;

  return Array.from(rrfScores.entries())
    .map(([localIdx, { rrfScore, cosineScore }]) => {
      let finalRrfScore = rrfScore;
      if (hasAlarmPattern && candidates[localIdx].metadata.isAlarmRelated === true) {
        finalRrfScore *= 1.5;
      }
      return {
        chunk: candidates[localIdx],
        score: cosineScore, // 임계값 필터링은 여전히 코사인 점수 기준
        rrfScore: finalRrfScore,
      };
    })
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, k)
    .map(({ chunk, score }) => ({ chunk, score }));
}

/**
 * 상위 검색 결과 주변의 인접 청크를 추가해 LLM 컨텍스트를 풍부하게 만듦
 * - 상위 topN개 결과에 대해서만 ±windowSize 청크를 확장
 * - 이미 포함된 청크는 중복 추가하지 않음
 */
export function expandWithNeighbors(
  results: SearchResult[],
  topN: number = 3,
  windowSize: number = 1
): SearchResult[] {
  const store = loadVectorStore();
  if (!store) return results;

  // filename::chunkIndex → chunk 빠른 조회맵
  const byKey = new Map<string, TextChunk>();
  for (const chunk of store.chunks) {
    byKey.set(`${chunk.metadata.filename}::${chunk.metadata.chunkIndex}`, chunk);
  }

  const includedIds = new Set(results.map((r) => r.chunk.id));
  const expanded: SearchResult[] = [...results];

  for (const result of results.slice(0, topN)) {
    const { filename, chunkIndex } = result.chunk.metadata;
    for (let delta = -windowSize; delta <= windowSize; delta++) {
      if (delta === 0) continue;
      const neighbor = byKey.get(`${filename}::${chunkIndex + delta}`);
      if (neighbor && !includedIds.has(neighbor.id)) {
        includedIds.add(neighbor.id);
        // 인접 청크는 원본 score의 80%로 낮게 처리
        expanded.push({ chunk: neighbor, score: result.score * 0.8 });
      }
    }
  }

  return expanded;
}

export function buildChunk(
  text: string,
  embedding: number[],
  filename: string,
  page: number,
  chunkIndex: number,
  extraMeta?: Partial<TextChunk["metadata"]>
): TextChunk {
  return {
    id: crypto.randomUUID(),
    text,
    embedding,
    metadata: { filename, page, chunkIndex, ...extraMeta },
  };
}
