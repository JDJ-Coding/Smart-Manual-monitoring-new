// scripts/export-chunks-for-analysis.js
// 벡터 스토어에서 384차원 임베딩 배열을 제거한 경량 JSON 생성
// - 입력: data/vector-store/index.json
// - 출력: data/vector-store/chunks-text-only.json
// 용도: anthropics-data-exploration 스킬로 청크 품질 분석

const fs = require("fs");
const path = require("path");

const INPUT  = path.join(__dirname, "..", "data", "vector-store", "index.json");
const OUTPUT = path.join(__dirname, "..", "data", "vector-store", "chunks-text-only.json");

if (!fs.existsSync(INPUT)) {
  console.error("벡터 스토어를 찾을 수 없습니다:", INPUT);
  console.error("먼저 POST /api/build-db 로 벡터 DB를 구축하세요.");
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(INPUT, "utf-8"));

const exported = {
  version:     store.version,
  builtAt:     store.builtAt,
  totalChunks: store.totalChunks,
  chunks: store.chunks.map(({ id, text, metadata }) => ({ id, text, metadata })),
};

fs.writeFileSync(OUTPUT, JSON.stringify(exported, null, 2), "utf-8");

const inKB  = Math.round(fs.statSync(INPUT).size  / 1024);
const outKB = Math.round(fs.statSync(OUTPUT).size / 1024);
console.log(`완료: ${exported.totalChunks}개 청크 | ${inKB}KB → ${outKB}KB (${Math.round((1 - outKB / inKB) * 100)}% 감소)`);
console.log(`출력 파일: ${OUTPUT}`);
