# Embedding/Vector DB 최적화 가이드 (설비 엔지니어링 특화)

## 1) 임베딩 모델 선택
- 1순위(다국어 + 기술문서): `intfloat/multilingual-e5-large-instruct`
- 2순위(경량/온프레): `BAAI/bge-m3` (현재 프로젝트와 호환성이 높음)
- 영어 중심 대안: `BAAI/bge-large-en-v1.5`

### 권장 설정
- Query prefix: `query: ...`
- Passage prefix: `passage: ...`
- chunk 길이: 220~450 tokens (표/파라미터는 더 짧게 분할)
- overlap: 10~15%

## 2) 벡터 DB
### Chroma (로컬/PoC)
- HNSW metric: cosine
- ef_construction: 200 이상
- M: 48 (메모리 허용 시)
- metadata 필터: `manual`, `page`, `chunk_type`, `equipment_name`

### Pinecone (운영/확장)
- pod 타입: 질의량이 적으면 starter/s1, 운영은 p1 이상
- namespace 분리: 장비군(servo/inverter/plc)별 namespace
- sparse+dense hybrid 인덱스 사용 권장

## 3) Re-rank
- Cross-encoder를 최종 상위 30~50개에만 적용
- 알람 질의는 숫자 exact-match를 hard filter로 우선 적용

## 4) 관찰 지표 (반드시 운영 대시보드화)
- Retrieval Recall@k (k=5,10)
- Citation Coverage (% 문장 중 인용 포함 비율)
- No-grounding Rate (근거 없음 응답률)
- Alarm Exact Hit Rate (`no.13` 질의에서 13 정확회수율)
