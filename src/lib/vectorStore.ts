import fs from "fs";
import path from "path";
import type { VectorStore, TextChunk, SearchResult } from "@/types";

const STORE_PATH = path.join(process.cwd(), "data", "vector-store", "index.json");

let _cache: VectorStore | null = null;

export function loadVectorStore(): VectorStore | null {
  if (_cache) return _cache;
  if (!fs.existsSync(STORE_PATH)) return null;

  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    _cache = JSON.parse(raw) as VectorStore;
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
}

export function clearVectorStoreCache(): void {
  _cache = null;
}

// Since embeddings are normalized, cosine similarity = dot product
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export interface SearchOptions {
  k?: number;
  filterFilename?: string;
}

export function searchVectorStore(
  queryEmbedding: number[],
  options: SearchOptions = {}
): SearchResult[] {
  const store = loadVectorStore();
  if (!store || store.chunks.length === 0) return [];

  const { k = 10, filterFilename } = options;

  let candidates = store.chunks;
  if (filterFilename) {
    candidates = candidates.filter((c) => c.metadata.filename === filterFilename);
  }

  return candidates
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function buildChunk(
  text: string,
  embedding: number[],
  filename: string,
  page: number,
  chunkIndex: number
): TextChunk {
  return {
    id: crypto.randomUUID(),
    text,
    embedding,
    metadata: { filename, page, chunkIndex },
  };
}
