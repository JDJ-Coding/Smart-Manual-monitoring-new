# CLAUDE.md — Smart Manual Assistant

산업 설비 유지보수 매뉴얼 기반 AI Q&A 시스템 (POSCO 사내 사용)

---

## 프로젝트 개요

PDF로 업로드된 설비 매뉴얼을 로컬 벡터 DB로 인덱싱하고, 사용자 질문에 대해
관련 매뉴얼 청크를 검색한 뒤 POSCO 사내 GPT API를 통해 답변을 생성하는 RAG 시스템.

---

## 기술 스택

| 분류 | 도구 |
|------|------|
| 프레임워크 | Next.js 14.2 (App Router) + TypeScript 5.6 |
| 임베딩 | `@huggingface/transformers` — `Xenova/multilingual-e5-small` (q8 quantized, 로컬) |
| PDF 파싱 | `pdf-parse` |
| LLM | POSCO 사내 GPT API (`aigpt.posco.net`) — 모델 `gpt-5.2` |
| 스타일 | Tailwind CSS + Pretendard Variable 폰트 |
| 아이콘 | Lucide React |

---

## 개발 환경 실행

```bash
npm install
npm run dev          # http://localhost:3000 (0.0.0.0 바인딩)
npm run build
npm run start
```

### 필수 환경 변수 (`.env.local`)

```env
POSCO_GPT_KEY=<사내_GPT_Bearer_토큰>
ADMIN_PASSWORD=posco          # 기본값 "posco", 변경 권장
```

> `POSCO_GPT_KEY`는 회사 PC에서 Windows 시스템 환경 변수로도 설정 가능.

---

## 디렉터리 구조

```
src/
├── app/
│   ├── page.tsx                  # 메인 채팅 UI (클라이언트, localStorage 세션)
│   ├── admin/                    # 관리자 대시보드 + 로그인
│   └── api/
│       ├── chat/route.ts         # POST /api/chat — 핵심 Q&A 엔드포인트
│       ├── build-db/route.ts     # POST /api/build-db — 벡터 DB 재구축
│       ├── db-status/route.ts    # GET  /api/db-status
│       ├── manuals/route.ts      # GET/POST PDF 관리
│       └── auth/                 # 로그인/로그아웃
├── components/
│   ├── chat/                     # ChatContainer, ChatMessage, ChatInput, QuickPanel, SourceCitation
│   ├── layout/Sidebar.tsx        # 세션 목록, 매뉴얼 선택, DB 상태
│   └── admin/                    # AdminPanel, ManualList, PdfUploader, BuildDbButton
├── lib/
│   ├── embeddings.ts             # HuggingFace 임베딩 파이프라인 (싱글턴)
│   ├── vectorStore.ts            # 코사인 유사도 검색, JSON 저장/로드
│   ├── pdfParser.ts              # PDF 텍스트 추출 + 청킹 (1200자 / 300자 오버랩)
│   ├── poscoGpt.ts               # POSCO GPT API 호출 + 프롬프트 빌더
│   └── auth.ts                   # 쿠키 기반 관리자 인증 (8시간)
├── types/index.ts                # 도메인 타입 정의
└── middleware.ts                 # /admin, POST /api 인증 보호

data/
├── manuals/                      # 업로드된 PDF (gitignore)
└── vector-store/index.json       # 생성된 벡터 DB (gitignore)
```

---

## 핵심 아키텍처: RAG 파이프라인

```
질문 입력
  → buildContextualQuery()       # 최근 2개 사용자 메시지 + 현재 질문 결합
  → embedText()                  # "query: " 접두사 + e5 모델로 384차원 벡터 생성
  → searchVectorStore()          # 코사인 유사도 Top-10, score < 0.3 필터링
  → callPoscoGpt()               # 관련 청크 컨텍스트 + 질문으로 GPT 호출
  → 답변 + 출처 반환
```

### 임베딩 모델 주의사항

- **질문** 임베딩: `embedText()` → `"query: "` 접두사
- **문서 청킹** 임베딩: `embedPassage()` → `"passage: "` 접두사
- 두 함수를 혼동하면 유사도 품질이 크게 떨어지므로 주의
- 모델 파일 위치: `model/` 폴더 (로컬, 원격 다운로드 비활성화)
- 최초 로딩 시 10~20초 지연 발생 (ONNX 초기화)

### 벡터 검색 임계값

```typescript
// src/app/api/chat/route.ts
const MIN_SCORE = 0.3;  // 코사인 유사도 0.3 미만은 노이즈로 제거
```

관련 청크가 없으면 GPT는 전문 지식으로 답변 (하드코딩 에러 메시지 반환 안 함)

### POSCO GPT API

```typescript
// src/lib/poscoGpt.ts
endpoint: "http://aigpt.posco.net/gpgpta01-gpt/gptApi/personalApi"
model: "gpt-5.2"
temperature: 0.7
대화 히스토리: 마지막 6개 메시지 (3 왕복)
```

프롬프트는 질문 유형에 따라 자동 분기:
- **알람 코드 / 고장 증상** → 알람 의미 · 원인 · 조치 방법 구조화 답변
- **사양 / 절차 / 개념 등 일반 질문** → 매뉴얼 내용 기반 자연스러운 답변
- **매뉴얼 무관 질문** → 전문 지식으로 답변, 매뉴얼 미검색 안내

---

## PDF 처리

```typescript
// src/lib/pdfParser.ts
청크 크기: 1200자
오버랩: 300자 (25%)
최소 청크: 50자
```

`data/manuals/` 폴더의 PDF를 `POST /api/build-db`로 일괄 처리.

---

## 인증

- 경로 `/admin/**`, `POST /api/**` → `middleware.ts`에서 쿠키 검증
- 쿠키명: `smart_manual_admin`
- 토큰 형식: `Base64(admin:{password}:{timestamp})`
- 만료: 8시간

---

## 클라이언트 상태 (localStorage)

- 세션 최대 60개 저장, 초과 시 오래된 것부터 자동 삭제
- `selectedManual`: "전체 매뉴얼 검색" 또는 특정 파일명으로 벡터 검색 범위 필터링

---

## 타입 정의 (`src/types/index.ts`)

```typescript
TextChunk       { id, text, embedding[], metadata{filename, page, chunkIndex} }
VectorStore     { version, builtAt, totalChunks, chunks[] }
SearchResult    { chunk, score }
ChatMessage     { role, content, sources[], timestamp }
SourceReference { filename, page, excerpt }
ChatSession     { id, title, messages[], selectedManual, createdAt, updatedAt }
```

---

## 자주 하는 실수 / 주의사항

1. **`embedText` vs `embedPassage` 혼동 금지** — 반드시 용도에 맞게 사용
2. **벡터 DB 경로는 `data/vector-store/index.json`** — `data/` 내 다른 위치 사용 금지
3. **`data/manuals/`, `data/vector-store/index.json`은 gitignore 대상** — 커밋 불필요
4. **`model/` 폴더도 gitignore** — HuggingFace 모델 파일 (~130 MB), USB로 배포
5. **사내망 전용** — POSCO GPT API는 외부 네트워크에서 접근 불가
6. **Webpack 설정 (`next.config.mjs`) 변경 시 주의** — ONNX/WASM 로딩에 직접 영향
7. **관리자 비밀번호 기본값 "posco"** — 실 배포 시 `ADMIN_PASSWORD` 환경 변수로 변경

---

## 참고 문서

- `research.md` — 아키텍처 심층 분석 (한국어, 36KB)
- `회사_사용_가이드.md` — 현장 설치 및 사용 가이드 (한국어)
