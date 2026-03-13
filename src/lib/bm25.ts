/**
 * BM25 (Best Match 25) 텍스트 검색 알고리즘
 * 키워드 기반 검색으로 코사인 유사도의 의미 기반 검색을 보완
 * k1=1.5, b=0.75 (표준 파라미터)
 */

export interface BM25Index {
  /** 각 문서(청크)의 토크나이즈된 단어 목록 */
  docs: string[][];
  /** 단어별 역문서빈도(IDF) */
  idf: Map<string, number>;
  /** 각 문서의 길이 */
  docLengths: number[];
  /** 전체 평균 문서 길이 */
  avgDocLength: number;
}

const K1 = 1.5;
const B = 0.75;

/** 텍스트를 토큰으로 분할 (공백, 특수문자 기준) */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/** BM25 인덱스 빌드 */
export function buildBM25Index(texts: string[]): BM25Index {
  const docs = texts.map(tokenize);
  const docLengths = docs.map((d) => d.length);
  const totalLen = docLengths.reduce((s, l) => s + l, 0);
  const avgDocLength = docs.length > 0 ? totalLen / docs.length : 1;
  const N = docs.length;

  // 단어별 문서 빈도(DF) 계산
  const df = new Map<string, number>();
  for (const doc of docs) {
    const uniqueTokens = new Set(doc);
    for (const token of uniqueTokens) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  // IDF = log((N - df + 0.5) / (df + 0.5) + 1)
  const idf = new Map<string, number>();
  for (const [term, freq] of df) {
    idf.set(term, Math.log((N - freq + 0.5) / (freq + 0.5) + 1));
  }

  return { docs, idf, docLengths, avgDocLength };
}

/** BM25 점수 계산 및 Top-K 반환 */
export function searchBM25(
  query: string,
  index: BM25Index,
  k: number = 20
): Array<{ docIndex: number; score: number }> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scores: number[] = new Array(index.docs.length).fill(0);

  for (const token of queryTokens) {
    const idfScore = index.idf.get(token) ?? 0;
    if (idfScore === 0) continue;

    for (let i = 0; i < index.docs.length; i++) {
      const doc = index.docs[i];
      const docLen = index.docLengths[i];
      const tf = doc.filter((t) => t === token).length;
      if (tf === 0) continue;

      const numerator = tf * (K1 + 1);
      const denominator = tf + K1 * (1 - B + B * (docLen / index.avgDocLength));
      scores[i] += idfScore * (numerator / denominator);
    }
  }

  return scores
    .map((score, docIndex) => ({ docIndex, score }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
