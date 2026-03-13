# CLAUDE.md — Smart Manual Assistant

산업 설비 유지보수 매뉴얼 기반 AI Q&A 시스템 (POSCO 사내 사용)

---

## 프로젝트 개요

PDF로 업로드된 설비 매뉴얼을 로컬 벡터 DB로 인덱싱하고, 사용자 질문에 대해
관련 매뉴얼 청크를 검색한 뒤 POSCO 사내 GPT API를 통해 답변을 생성하는 RAG 시스템.
에이전트 루프를 통한 도구 호출(계산기 등) 기능도 내장되어 있음.

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
│   ├── page.tsx                        # 메인 채팅 UI (클라이언트, localStorage 세션)
│   ├── layout.tsx                      # 루트 레이아웃 (Pretendard 폰트, lang="ko")
│   ├── globals.css                     # 전역 스타일
│   ├── admin/
│   │   ├── page.tsx                    # 관리자 대시보드 (서버 컴포넌트)
│   │   └── login/page.tsx              # 관리자 로그인
│   └── api/
│       ├── chat/route.ts               # POST /api/chat — 핵심 Q&A 엔드포인트
│       ├── build-db/route.ts           # POST /api/build-db — 벡터 DB 재구축
│       ├── db-status/route.ts          # GET  /api/db-status
│       ├── manuals/
│       │   ├── route.ts                # GET/POST PDF 관리
│       │   └── [filename]/route.ts     # DELETE /api/manuals/[filename]
│       └── auth/
│           ├── login/route.ts          # POST /api/auth/login
│           └── logout/route.ts         # POST /api/auth/logout
├── components/
│   ├── chat/
│   │   ├── ChatContainer.tsx           # 채팅 메인 인터페이스
│   │   ├── ChatMessage.tsx             # 마크다운 렌더링 메시지
│   │   ├── ChatInput.tsx               # 텍스트 입력창
│   │   ├── QuickPanel.tsx              # 빠른 질문 패널 (XL 화면 전용)
│   │   ├── SourceCitation.tsx          # 출처 문서 인용
│   │   └── WelcomeScreen.tsx           # 초기 화면 (예시 질문 표시)
│   ├── layout/
│   │   └── Sidebar.tsx                 # 세션 목록, 매뉴얼 선택, DB 상태
│   └── admin/
│       ├── AdminPanel.tsx              # 관리자 대시보드 레이아웃
│       ├── ManualList.tsx              # 업로드된 PDF 목록
│       ├── PdfUploader.tsx             # 드래그앤드롭 PDF 업로더
│       └── BuildDbButton.tsx           # DB 재구축 버튼
├── lib/
│   ├── embeddings.ts                   # HuggingFace 임베딩 파이프라인 (싱글턴)
│   ├── vectorStore.ts                  # 코사인 유사도 검색, JSON 저장/로드
│   ├── pdfParser.ts                    # PDF 텍스트 추출 + 청킹 (1200자 / 300자 오버랩)
│   ├── poscoGpt.ts                     # POSCO GPT API 호출 + 프롬프트 빌더
│   ├── agent.ts                        # 에이전트 루프 (도구 호출 관리)
│   ├── tools.ts                        # 도구 구현 (calculator 등)
│   └── auth.ts                         # 쿠키 기반 관리자 인증 (8시간)
├── types/index.ts                      # 도메인 타입 정의
└── middleware.ts                       # /admin, POST /api 인증 보호

data/
├── manuals/                            # 업로드된 PDF (gitignore)
└── vector-store/index.json             # 생성된 벡터 DB (gitignore)
```

---

## API 엔드포인트

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/chat` | 공개 | Q&A (벡터 검색 + 에이전트) |
| POST | `/api/build-db` | 관리자 | 벡터 DB 재구축 |
| GET | `/api/db-status` | 공개 | DB 빌드 상태 확인 |
| GET | `/api/manuals` | 공개 | 업로드된 PDF 목록 |
| POST | `/api/manuals` | 관리자 | PDF 업로드 |
| DELETE | `/api/manuals/[filename]` | 관리자 | PDF 삭제 |
| POST | `/api/auth/login` | 공개 | 로그인 (쿠키 설정) |
| POST | `/api/auth/logout` | 관리자 | 로그아웃 (쿠키 삭제) |

---

## 핵심 아키텍처: RAG + 에이전트 파이프라인

```
질문 입력
  → buildContextualQuery()       # 최근 2개 사용자 메시지 + 현재 질문 결합
  → embedText()                  # "query: " 접두사 + e5 모델로 384차원 벡터 생성
  → searchVectorStore()          # 코사인 유사도 Top-10, score < 0.3 필터링
  → runChatAgent()               # 에이전트 루프 실행
      ├─ 1차 GPT 호출 (도구 포함)
      ├─ 도구 실행 (calculator 등, 필요 시)
      └─ 2차 GPT 호출 (도구 결과 반영)
  → 답변 + 출처 + toolUsed + toolLogs 반환
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

### 에이전트 & 도구 호출 (`src/lib/agent.ts`, `src/lib/tools.ts`)

```
runChatAgent()
  1. GPT 호출 (tools 파라미터 포함)
  2. tool_calls 응답 시 → executeTool() 실행
  3. 도구 결과를 메시지에 추가 후 재호출
  4. 최종 텍스트 응답 반환
```

현재 구현된 도구:
- **`calculator`**: 수식 계산 (Math 함수 화이트리스트로 안전하게 실행)
  - 허용 함수: `abs, ceil, floor, round, max, min, pow, sqrt`

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

- 세션 최대 **30개** 저장, 초과 시 오래된 것부터 자동 삭제
- 세션 제목: 첫 번째 메시지 앞 45자로 자동 생성
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
ToolLog         { toolName, input, output, timestamp }
PoscoToolCall   { id, type, function{name, arguments} }
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
8. **`agent.ts`에 새 도구 추가 시** — `tools.ts`에 구현 후 `poscoGpt.ts`의 tools 배열에도 등록 필요
9. **세션 상한은 30개** — 코드 변경 시 `src/app/page.tsx`의 `MAX_SESSIONS` 상수 확인

---

## 참고 문서

- `research.md` — 아키텍처 심층 분석 (한국어, 36KB)
- `회사_사용_가이드.md` — 현장 설치 및 사용 가이드 (한국어)
- `DESIGN_SYSTEM.md` — Figma MCP 통합용 디자인 시스템 규칙 (색상 토큰, 컴포넌트 패턴, 코드 변환 가이드)

---

## Skills 활용 가이드

### 1. `/simplify` — 컴포넌트 코드 단순화

코드 변경 후 실행하면 중복 제거, 효율성, 재사용성을 자동 검토합니다.

**주요 대상 파일:**
- `src/components/chat/ChatContainer.tsx` — 채팅 상태 관리 + 이벤트 핸들러
- `src/components/layout/Sidebar.tsx` — 세션 목록 + 매뉴얼 필터 복합 로직
- `src/components/chat/ChatMessage.tsx` — 마크다운 렌더링 + 피드백 UI

**사용법:**
```
/simplify
```
실행 후 반드시 `npm run build`로 TypeScript 컴파일 확인.

**주의:** `embedText` / `embedPassage` 함수 시그니처 변경 금지.

---

### 2. Figma MCP — 디자인 → Tailwind 코드 변환

연결 상태: 전역 MCP 연결됨 (`mcp__figma-remote-mcp__*` 도구 자동 승인)

**컴포넌트 경로 매핑 (Figma 프레임 → 코드):**

| Figma 프레임 | 코드 경로 |
|-------------|-----------|
| Chat Interface | `src/components/chat/ChatContainer.tsx` |
| Message Bubble | `src/components/chat/ChatMessage.tsx` |
| Input Bar | `src/components/chat/ChatInput.tsx` |
| Sidebar | `src/components/layout/Sidebar.tsx` |
| Welcome Screen | `src/components/chat/WelcomeScreen.tsx` |
| Quick Panel | `src/components/chat/QuickPanel.tsx` |
| Source Citation | `src/components/chat/SourceCitation.tsx` |
| Admin Dashboard | `src/components/admin/AdminPanel.tsx` |

**디자인 시스템:**
- 색상: `brand.DEFAULT: #3b82f6`, `brand.hover: #2563eb` (`tailwind.config.ts`)
- 폰트: `Pretendard Variable` → `font-pretendard`
- 애니메이션: `fadeUp`, `fadeIn`, `slideRight`, `slideInLeft`
- 아이콘: `lucide-react`

**사용법:** Figma URL을 대화에 붙여넣으면 MCP가 자동 분석 후 Tailwind 코드 생성.

---

### 3. `anthropics-data-exploration` — 벡터 스토어 데이터 분석

연결 상태: Smithery 전역 설치됨

**선행 작업 (벡터 DB 구축 후 실행):**
```bash
node scripts/export-chunks-for-analysis.js
# 출력: data/vector-store/chunks-text-only.json (임베딩 제거 경량 버전)
```

**유용한 분석 질문 예시:**
- "파일별 청크 수 분포를 보여줘"
- "평균 청크 길이와 분포 히스토그램"
- "알람 코드(E-xxx, AL-xxx 패턴) 포함 청크 추출"
- "50자 미만 노이즈 청크 목록"
- "특정 키워드('과열', '진동', '압력')가 많은 파일은?"
- "코사인 유사도 0.3 임계값 최적화를 위한 점수 분포 분석"
