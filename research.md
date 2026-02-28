# Smart Manual Assistant — 코드베이스 심층 연구 보고서

**프로젝트 경로:** `C:\Users\장덕진\Desktop\코드\Smart-Manual-monitoring-new`
**보고서 작성일:** 2026-03-01
**분석 범위:** `src/` 내 전체 파일, 설정 파일, 의존성

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [디렉토리 구조](#2-디렉토리-구조)
3. [설정 파일](#3-설정-파일)
4. [타입 시스템](#4-타입-시스템)
5. [인증 시스템](#5-인증-시스템)
6. [프론트엔드 — 페이지 및 라우팅](#6-프론트엔드--페이지-및-라우팅)
7. [프론트엔드 — 컴포넌트 아키텍처](#7-프론트엔드--컴포넌트-아키텍처)
8. [상태 관리 및 세션 영속성](#8-상태-관리-및-세션-영속성)
9. [API 라우트](#9-api-라우트)
10. [라이브러리 레이어](#10-라이브러리-레이어)
11. [벡터 스토어 및 임베딩](#11-벡터-스토어-및-임베딩)
12. [POSCO GPT 통합](#12-posco-gpt-통합)
13. [엔드-투-엔드 요청 흐름](#13-엔드-투-엔드-요청-흐름)
14. [관리자 패널 흐름](#14-관리자-패널-흐름)
15. [데이터 디렉토리 및 영속성](#15-데이터-디렉토리-및-영속성)
16. [의존성](#16-의존성)
17. [발견된 버그 및 이슈](#17-발견된-버그-및-이슈)
18. [성능 고려 사항](#18-성능-고려-사항)
19. [핵심 파일 참조표](#19-핵심-파일-참조표)

---

## 1. 프로젝트 개요

**Smart Manual Assistant**는 POSCO 사내용 산업 설비 유지보수 매뉴얼 AI 질의응답 시스템이다.

### 핵심 기능
- PDF 매뉴얼을 업로드하면 텍스트를 청크 단위로 분해하고, 로컬 임베딩 모델(`multilingual-e5-small`)로 벡터화하여 JSON 파일에 저장
- 사용자가 자연어로 질문하면, 질문을 임베딩하고 코사인 유사도 검색으로 관련 청크를 Top-K 추출
- 추출된 청크를 컨텍스트로 POSCO 내부 GPT API(GPT-4o 기반)를 호출하여 한국어 답변 생성
- 채팅 세션은 localStorage에 저장, 관리자 기능은 쿠키 기반 인증으로 보호

### 기술 스택
| 항목 | 값 |
|---|---|
| 프레임워크 | Next.js 14.2.18 (App Router) |
| 언어 | TypeScript 5.6.3 |
| UI 스타일링 | Tailwind CSS 3.4.14 |
| 아이콘 | lucide-react 0.462.0 |
| 임베딩 모델 | @huggingface/transformers 3.1.2 (Xenova/multilingual-e5-small, q8 양자화) |
| PDF 파싱 | pdf-parse 1.1.1 |
| AI API | POSCO GPT (GPT-4o 기반, 사내 엔드포인트) |
| 폰트 | Pretendard Variable (로컬 woff2) |

---

## 2. 디렉토리 구조

```
Smart-Manual-monitoring-new/
├── data/
│   ├── manuals/          ← PDF 파일 저장소 (런타임 생성)
│   └── vector-store/
│       └── index.json    ← 벡터 DB (런타임 생성)
├── model/
│   └── Xenova/
│       └── multilingual-e5-small/  ← 로컬 임베딩 모델
├── public/
│   └── fonts/
│       └── PretendardVariable.woff2
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← 루트 레이아웃 (Pretendard 폰트, ko 언어)
│   │   ├── page.tsx                ← 메인 채팅 페이지 (클라이언트 컴포넌트)
│   │   ├── globals.css             ← 전역 스타일 (스크롤바, 타이핑 애니메이션)
│   │   ├── admin/
│   │   │   ├── page.tsx            ← 관리자 대시보드 (서버 컴포넌트, SSR)
│   │   │   └── login/
│   │   │       └── page.tsx        ← 관리자 로그인 (클라이언트 컴포넌트)
│   │   └── api/
│   │       ├── chat/route.ts       ← POST /api/chat
│   │       ├── build-db/route.ts   ← POST /api/build-db
│   │       ├── db-status/route.ts  ← GET /api/db-status
│   │       ├── manuals/
│   │       │   ├── route.ts        ← GET/POST /api/manuals
│   │       │   └── [filename]/
│   │       │       └── route.ts    ← DELETE /api/manuals/[filename]
│   │       └── auth/
│   │           ├── login/route.ts  ← POST /api/auth/login
│   │           └── logout/route.ts ← POST /api/auth/logout
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx         ← 세션 목록 + 매뉴얼 선택 + DB 상태
│   │   ├── chat/
│   │   │   ├── ChatContainer.tsx   ← 채팅 영역 컨테이너
│   │   │   ├── ChatMessage.tsx     ← 메시지 렌더러 (마크다운 파서 포함)
│   │   │   ├── ChatInput.tsx       ← 텍스트 입력 + 전송 버튼
│   │   │   ├── SourceCitation.tsx  ← 참조 문서 표시
│   │   │   └── WelcomeScreen.tsx   ← 빈 상태 화면
│   │   └── admin/
│   │       ├── AdminPanel.tsx      ← 관리자 대시보드 레이아웃
│   │       ├── ManualList.tsx      ← PDF 파일 목록 + 삭제
│   │       ├── PdfUploader.tsx     ← 드래그앤드롭 PDF 업로더
│   │       └── BuildDbButton.tsx   ← DB 재구축 버튼
│   ├── lib/
│   │   ├── auth.ts                 ← 토큰 생성/검증, 쿠키 유틸
│   │   ├── embeddings.ts           ← HuggingFace 임베딩 파이프라인 (싱글톤)
│   │   ├── vectorStore.ts          ← JSON 벡터 스토어 CRUD + 코사인 유사도 검색
│   │   ├── pdfParser.ts            ← PDF → 청크 변환 (1200자, 300자 오버랩)
│   │   └── poscoGpt.ts             ← POSCO GPT API 호출 + 프롬프트 빌더
│   ├── middleware.ts               ← Edge 미들웨어: /admin, /api/manuals(POST/DELETE), /api/build-db 보호
│   └── types/
│       └── index.ts                ← 공유 TypeScript 인터페이스
├── next.config.mjs                 ← Webpack 설정 (ONNX, WebAssembly, 파일 감시)
├── tailwind.config.ts              ← 애니메이션 키프레임 정의
└── package.json
```

---

## 3. 설정 파일

### `next.config.mjs`
```js
serverExternalPackages: ["@huggingface/transformers", "pdf-parse", "onnxruntime-node"]
```
- `@huggingface/transformers`, `pdf-parse`, `onnxruntime-node`을 서버 외부 패키지로 선언 → Node.js 네이티브 모듈로 처리, Next.js 번들에서 제외
- `sharp$: false`, `onnxruntime-node$: false` 알리아스로 클라이언트 사이드 import 방지
- `asyncWebAssembly: true` → ONNX 런타임에 필요한 WebAssembly 비동기 로드 허용
- `watchOptions.ignored` → Windows 시스템 파일(`pagefile.sys` 등)로 인한 EPERM 오류 방지

### `tailwind.config.ts`
커스텀 애니메이션 4가지 정의 (globals.css가 아닌 Tailwind에서 관리):
| 클래스명 | 효과 | 지속시간 |
|---|---|---|
| `animate-fadeUp` | 아래→위로 12px 슬라이드 + 페이드인 | 0.4s |
| `animate-fadeIn` | 단순 페이드인 | 0.3s |
| `animate-slideRight` | 좌→우 8px 슬라이드 + 페이드인 | 0.25s |
| `animate-slideInLeft` | 왼쪽 밖→안쪽 슬라이드 | 0.25s |

커스텀 색상: `brand.DEFAULT = #3b82f6` (블루-500), `brand.hover = #2563eb` (블루-600)

### `globals.css`
- 전역 Tailwind 레이어 import
- 얇은 다크 스크롤바 (4px, zinc-600 계열)
- `textarea { resize: none }`
- `.typing-dot` 애니메이션 (3개의 점이 순서대로 위아래로 튐) — keyframe은 CSS에서 직접 정의

---

## 4. 타입 시스템

파일: `src/types/index.ts`

```typescript
// 벡터 스토어의 단위 청크
interface TextChunk {
  id: string;           // crypto.randomUUID()
  text: string;         // 원문 텍스트 (최대 1200자)
  embedding: number[];  // 384차원 벡터 (multilingual-e5-small)
  metadata: {
    filename: string;   // PDF 파일명
    page: number;       // 페이지 번호 (1-indexed)
    chunkIndex: number; // 전체 문서 내 청크 순번
  };
}

// 벡터 스토어 전체 (JSON 파일)
interface VectorStore {
  version: number;    // 현재 1
  builtAt: string;    // ISO 8601 타임스탬프
  totalChunks: number;
  chunks: TextChunk[];
}

// 유사도 검색 결과
interface SearchResult {
  chunk: TextChunk;
  score: number;      // 코사인 유사도 (-1 ~ 1)
}

// 채팅 메시지
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SourceReference[];  // assistant 메시지에만 존재
  timestamp: string;            // ISO 8601
}

// 소스 참조
interface SourceReference {
  filename: string;
  page: number;
  excerpt: string;  // 해당 청크의 앞 150자
}

// PDF 파일 메타데이터 (관리자 패널용)
interface ManualFile {
  filename: string;
  sizeBytes: number;
  uploadedAt: string;  // fs.stat().mtime
}

// 채팅 세션 (localStorage 저장 단위)
interface ChatSession {
  id: string;          // generateId() 결과
  title: string;       // 첫 메시지 앞 45자
  messages: ChatMessage[];
  selectedManual: string;   // 검색 범위 스냅샷
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. 인증 시스템

### 구조

```
사용자 → /admin/login (UI) → POST /api/auth/login → httpOnly 쿠키 설정
                                                  ↓
middleware.ts ← 모든 /admin/* 및 쓰기 API 요청에서 쿠키 검증
```

### `src/lib/auth.ts` 핵심 함수

**`createToken(password)`**
- `admin:${password}:${Date.now()}` 문자열을 Base64 인코딩하여 반환
- 보안 취약점: 타임스탬프가 포함되어 있지만, 만료 검증 없이 비밀번호만 대조

**`validateToken(token)`**
- Base64 디코딩 → `:` 분리 → `parts[0] === "admin"` && `parts[1] === ADMIN_PASSWORD`
- 환경변수 `ADMIN_PASSWORD` 미설정 시 기본값 `"posco"`

**`isAdminAuthenticated(request: NextRequest)`**
- 미들웨어용: request 객체에서 쿠키 직접 추출 후 검증

**`checkAdminFromCookies()`**
- 서버 컴포넌트용: next/headers의 `cookies()` 사용 (async)

### 쿠키 설정
```
이름: smart_manual_admin
httpOnly: true        ← XSS 방어
path: /
maxAge: 28800초 (8시간)
sameSite: strict      ← CSRF 방어
secure: false         ← HTTPS 미적용 (내부망 전제)
```

### `src/middleware.ts`
Edge Runtime에서 실행. 보호 대상:
- `/admin/*` (단, `/admin/login` 제외) → 미인증 시 `/admin/login`으로 리다이렉트
- `/api/manuals` (POST/DELETE) → 미인증 시 401 JSON
- `/api/build-db` (POST) → 미인증 시 401 JSON

**주의:** GET `/api/manuals`와 GET `/api/db-status`는 **인증 없이** 공개 접근 가능

---

## 6. 프론트엔드 — 페이지 및 라우팅

### `src/app/layout.tsx`
- 루트 레이아웃 서버 컴포넌트
- `lang="ko"` 설정
- Pretendard Variable 폰트 로드 (로컬 woff2, `weight: "45 920"` 가변 폰트)
- `bg-zinc-950 text-zinc-100 antialiased` 전역 기본 스타일

### `src/app/page.tsx` — 메인 채팅 페이지
`"use client"` 클라이언트 컴포넌트. 앱의 중앙 상태 관리 허브.

**상태:**
```typescript
manualFiles: string[]           // API에서 로드된 PDF 목록
dbBuilt: boolean                // DB 구축 여부
selectedManual: string          // "전체 매뉴얼 검색" 또는 특정 파일명
sessions: ChatSession[]         // localStorage에서 로드/동기화
currentSessionId: string | null // 현재 선택된 세션 ID
chatKey: string                 // ChatContainer를 강제 언마운트/리마운트하는 key
currentSessionIdRef: RefObject  // 비동기 콜백에서 최신 ID 참조용
```

**초기화 (`useEffect` on mount):**
1. `loadSessions()` → localStorage에서 세션 배열 로드
2. `GET /api/manuals` → PDF 파일 목록 로드
3. `GET /api/db-status` → DB 구축 상태 확인

**핵심 핸들러:**

- `handleNewChat()`: `currentSessionId = null`, `chatKey = generateId()` → ChatContainer 초기화
- `handleSessionSelect(id)`: 해당 세션의 `selectedManual`을 복원 후 `currentSessionId` 설정
- `handleSessionDelete(id)`: sessions 배열에서 제거 후 localStorage 동기화
- `handleSessionUpdate(messages)`:
  - 세션 ID 없음 → 새 세션 생성 (첫 메시지 앞 45자를 제목으로)
  - 세션 ID 있음 → 기존 세션 업데이트

**`currentSessionIdRef` 사용 이유:**
`handleSessionUpdate`는 `useCallback`으로 메모이제이션되는데, 내부에서 `currentSessionId` 상태를 직접 참조하면 클로저 문제(stale closure)가 발생한다. `useRef`로 항상 최신값을 참조.

### `src/app/admin/page.tsx` — 관리자 대시보드
서버 컴포넌트. SSR 시점에:
1. `checkAdminFromCookies()` 인증 확인 → 미인증 시 `/admin/login` redirect
2. `listPdfFiles()` + `fs.stat()` → 파일 목록 수집
3. `loadVectorStore()` → DB 상태 확인
4. `AdminPanel` 클라이언트 컴포넌트에 props로 전달

### `src/app/admin/login/page.tsx` — 관리자 로그인
클라이언트 컴포넌트. 패스워드 입력 폼.
- `POST /api/auth/login` 호출
- 성공 시 `router.push("/admin")`
- 비밀번호 표시/숨기기 토글 포함

---

## 7. 프론트엔드 — 컴포넌트 아키텍처

### `Sidebar.tsx`
**Props:** `manualFiles`, `dbBuilt`, `selectedManual`, `onManualChange`, `sessions`, `currentSessionId`, `onNewChat`, `onSessionSelect`, `onSessionDelete`

**내부 상태:** `collapsed: boolean`, `mobileOpen: boolean`

**반응형 처리:**
- 데스크톱 (`md:flex`): 너비 64 (w-64) / 접힘 14 (w-14) 전환
- 모바일: `fixed` 오버레이 드로어 (z-30, w-72), 배경 오버레이 클릭으로 닫기

**세션 목록:**
- `formatRelativeTime(isoString)` → "방금 / N분 전 / N시간 전 / N일 전 / 날짜" 형식
- 세션 클릭 → `onSessionSelect` + `mobileOpen = false`
- 삭제 버튼: `group-hover:opacity-100`으로 hover 시 표시

**매뉴얼 셀렉터:**
- `["전체 매뉴얼 검색", ...manualFiles]` 배열을 `<select>`로 렌더링

**DB 상태 표시:**
- `dbBuilt` → emerald-400 "● 정상" / red-400 "● 미구축"
- 관리자 패널 링크 → `/admin/login`

---

### `ChatContainer.tsx`
**Props:** `dbBuilt`, `selectedManual`, `initialMessages`, `onSessionUpdate`

**내부 상태:** `messages`, `isLoading`, `showScrollBtn`

**스크롤 관리:**
- `bottomRef`: 메시지 영역 맨 아래 DOM 참조
- `scrollAreaRef`: 스크롤 컨테이너 참조
- `messages` 또는 `isLoading` 변경 시 `scrollToBottom()` 자동 호출
- `handleScroll`: 하단에서 200px 이상 위에 있으면 "↓" 버튼 표시

**메시지 전송 흐름 (`handleSend`):**
```
1. 사용자 메시지를 messages 배열에 즉시 추가
2. onSessionUpdate(withUser) 호출 → 세션 저장
3. isLoading = true → 타이핑 인디케이터 표시
4. POST /api/chat { question, filterFilename? }
5. 응답 수신 → assistant 메시지 생성
6. messages 업데이트 + onSessionUpdate(final)
7. isLoading = false
```

**상단 바:** `selectedManual` 뱃지 + DB 미구축 경고 표시

**하단 입력 영역:** `ChatInput` 컴포넌트 + DB 미구축 시 안내 메시지

---

### `ChatMessage.tsx`
**두 가지 렌더링 모드:**
- 사용자 메시지: `whitespace-pre-wrap` 단순 텍스트
- AI 메시지: `FormattedContent` 커스텀 마크다운 파서

**`FormattedContent` 파서 (라인 단위 처리):**
| 패턴 | 처리 |
|---|---|
| ` ``` ` | 코드 블록 (언어 레이블 포함) |
| `# ` | H1 → bold large |
| `## ` | H2 → bold medium |
| `### ` | H3 → semibold |
| `1. 2. ...` | 번호 목록 (파란 원형 번호 뱃지) |
| `- ` 또는 `* ` | 불릿 목록 (파란 점) |
| `---` | 수평선 |
| 빈 줄 | `<div className="h-1.5" />` 간격 |
| 일반 텍스트 | `<p>` + InlineMarkdown |

**`InlineMarkdown`:** `**bold**`, `` `code` `` 처리 (정규식 분리)

**기타 기능:**
- 복사 버튼 (hover 시 표시, 2초 후 체크마크 → 원래대로)
- `SourceCitation` 컴포넌트 (sources 있을 때만 표시)
- AI 메시지: 파란 점 인디케이터 왼쪽, 사용자 메시지: 파란 점 오른쪽

---

### `ChatInput.tsx`
- `textarea` (auto-resize, 최대 160px 높이)
- `Enter` → 전송, `Shift+Enter` → 줄바꿈
- `disabled` 시 회색 처리 + 커서 변경
- 키보드 힌트 (`Enter 전송 · Shift+Enter 줄바꿈`) 입력 가능 상태에서만 표시

---

### `SourceCitation.tsx`
- 접기/펼치기 토글 (초기 상태: 접힘)
- 각 소스: 파일명(basename만 추출), 페이지 뱃지, 발췌문(최대 2줄)
- `shortName()`: `filename.split(/[\\/]/).pop()` → 경로 구분자 제거

---

### `WelcomeScreen.tsx`
- `dbBuilt = true`: 예시 질문 6개 그리드 (클릭 시 `onExampleClick(text)` 호출)
- `dbBuilt = false`: 경고 카드 + 관리자 패널 링크

---

### `AdminPanel.tsx`
**Props:** `files`, `dbBuilt`, `totalChunks`, `dbBuiltAt`

**내부 상태:** 위 props를 useState로 복사하여 클라이언트 사이드 업데이트

**`refreshFiles()`:** `GET /api/manuals` 재호출 → files 상태 업데이트
**`refreshDbStatus()`:** `GET /api/db-status` 재호출 → DB 상태 업데이트 + `refreshFiles()`

**레이아웃:** sticky 헤더 + 3개의 카드 섹션 (DB 상태, PDF 업로드, 매뉴얼 목록)

---

### `ManualList.tsx`
**삭제 상태 머신:**
```
null → "confirm" → "deleting" → null (성공)
                              → "error" (실패)
```
- native `confirm()` 대신 인라인 확인 UI 사용
- 삭제 중: 스피너 + 다른 삭제 버튼 비활성화

---

### `PdfUploader.tsx`
- 드래그앤드롭 (dragover/dragleave/drop 이벤트)
- 클릭으로 파일 선택 (`<input type="file" accept=".pdf" multiple hidden>`)
- 업로드 성공 후 3초 뒤 메시지 자동 숨김

---

### `BuildDbButton.tsx`
상태: `"idle" | "building" | "done" | "error"`
- 구축 완료 후 버튼 텍스트 "DB 전체 재구축"으로 변경 (아이콘 RefreshCw)
- `onComplete` 콜백 → `AdminPanel.refreshDbStatus()` 호출

---

## 8. 상태 관리 및 세션 영속성

### localStorage 구조
```
키: "smart-manual-sessions"
값: JSON.stringify(ChatSession[])  // 최대 30개
```

### 세션 생명주기
```
새 대화 시작
  → handleNewChat() → currentSessionId = null, chatKey 변경
  → ChatContainer 리마운트 (빈 메시지 배열)
  → 첫 메시지 전송 시 handleSessionUpdate 호출
  → 새 ChatSession 생성 → currentSessionId 설정 → localStorage 저장

기존 세션 선택
  → handleSessionSelect(id) → selectedManual 복원
  → chatKey = id → ChatContainer가 initialMessages로 재초기화

메시지 전송마다
  → onSessionUpdate(messages) 호출
  → 기존 세션이면 updatedAt, messages, title 업데이트
  → localStorage 갱신
```

### 세션 제목 생성
첫 번째 메시지의 `content`를 45자로 잘라 `"…"` 추가. 매 업데이트마다 재계산 (이론적으로는 변하지 않음).

---

## 9. API 라우트

### `POST /api/chat`
파일: `src/app/api/chat/route.ts`
`maxDuration = 60초`

**Request Body:**
```json
{ "question": "인버터 과열 알람 원인?", "filterFilename": "MITSUBISHI_FR-E800.pdf" }
```

**Response (200):**
```json
{ "answer": "...", "sources": [{ "filename": "...", "page": 5, "excerpt": "..." }] }
```

**처리 흐름:**
1. 입력 검증 (question 빈값 → 400)
2. `embedText(question)` → 질문 임베딩 (query 접두사)
3. `searchVectorStore(embedding, { k: 10, filterFilename })` → Top-10 청크
4. results 없음 → 고정 메시지 반환
5. `callPoscoGpt(question, results)` → GPT 호출
6. `{ answer, sources }` 반환

---

### `GET /api/db-status`
파일: `src/app/api/db-status/route.ts`

**Response:**
```json
{ "built": true, "totalChunks": 1523, "builtAt": "2026-02-28T10:00:00Z" }
```

---

### `GET /api/manuals`
파일: `src/app/api/manuals/route.ts`
인증 불필요.

**Response:**
```json
{ "files": [{ "filename": "xxx.pdf", "sizeBytes": 2048000, "uploadedAt": "2026-02-28T..." }] }
```

---

### `POST /api/manuals`
인증 필요. `multipart/form-data`, 필드명 `files`.

PDF 파일만 허용 (`.pdf` 확장자 체크). `data/manuals/` 디렉토리에 저장.

---

### `DELETE /api/manuals/[filename]`
인증 필요.

`path.basename()` + `.pdf` 확장자 검증으로 경로 순회(path traversal) 공격 방어.

---

### `POST /api/build-db`
파일: `src/app/api/build-db/route.ts`
`maxDuration = 300초` (5분)
인증 필요.

**처리 흐름:**
1. `listPdfFiles()` → PDF 목록 확인
2. 각 PDF에 대해:
   a. `parsePdfToChunks(filePath)` → 페이지별 텍스트 청크
   b. 각 청크에 `embedPassage(text)` → 임베딩 벡터
   c. `buildChunk(...)` → `TextChunk` 객체 생성
3. `clearVectorStoreCache()` → 메모리 캐시 무효화
4. `saveVectorStore(store)` → `data/vector-store/index.json` 저장

---

### `POST /api/auth/login`
**Request:** `{ "password": "posco" }`
**Response (200):** `{ "success": true }` + `Set-Cookie: smart_manual_admin=...`

---

### `POST /api/auth/logout`
**Response (200):** `{ "success": true }` + 쿠키 삭제

---

## 10. 라이브러리 레이어

### `src/lib/pdfParser.ts`

**상수:**
```typescript
CHUNK_SIZE = 1200    // 청크 최대 문자수
CHUNK_OVERLAP = 300  // 청크 간 오버랩 문자수
```

**`extractPageTexts(filePath)`:**
`pdf-parse` 라이브러리의 `pagerender` 옵션을 커스터마이즈하여 페이지별 텍스트 배열 반환.
기본 `pdf-parse` 동작(전체 텍스트 합치기)이 아닌, 각 페이지를 독립적으로 처리.

**`splitTextWithOverlap(text, page, filename, startIndex)`:**
슬라이딩 윈도우 방식으로 청크 생성:
```
offset = 0
while offset < text.length:
  end = min(offset + 1200, text.length)
  chunk = text[offset:end].trim()
  if chunk.length > 50: 저장
  offset += 1200 - 300 = 900
```

**`parsePdfToChunks(filePath)`:**
각 페이지의 텍스트를 `splitTextWithOverlap`으로 처리, 전역 청크 인덱스 유지.

**`getManualsDir()`:** `process.cwd()/data/manuals`
**`listPdfFiles()`:** `getManualsDir()`에서 `.pdf` 파일만 필터링

---

### `src/lib/embeddings.ts`

**싱글톤 패턴:**
```typescript
let pipelineInstance: any = null;

async function getEmbeddingPipeline() {
  if (pipelineInstance) return pipelineInstance;
  // 초기화...
  return pipelineInstance;
}
```

**초기화 설정:**
```typescript
env.localModelPath = path.join(process.cwd(), "model");
env.allowRemoteModels = false;   // 네트워크 요청 금지
env.useBrowserCache = false;
// 양자화: "q8" (8-bit 정수 양자화)
```

**두 가지 임베딩 함수:**
- `embedText(text)`: `"query: " + text` 접두사 (e5 모델 쿼리 형식)
- `embedPassage(text)`: `"passage: " + text` 접두사 (e5 모델 문서 형식)
- 출력: mean pooling + normalize → 384차원 `Float32Array` → `number[]`

**e5 접두사 중요성:** `multilingual-e5` 모델은 asymmetric 검색 모델로, 쿼리와 패시지에 서로 다른 접두사를 요구한다. 없으면 품질이 크게 저하됨.

---

### `src/lib/vectorStore.ts`

**파일 경로:** `process.cwd()/data/vector-store/index.json`

**인메모리 캐시:**
```typescript
let _cache: VectorStore | null = null;
```
서버 재시작 전까지 JSON 파일 재파싱 없음.

**`loadVectorStore()`:** 캐시 확인 → 파일 읽기 → JSON 파싱 → 캐시 저장
**`saveVectorStore(store)`:** 파일 쓰기 + 캐시 갱신
**`clearVectorStoreCache()`:** `_cache = null` → 다음 load 시 파일에서 재읽기

**`cosineSimilarity(a, b)`:**
정규화된 벡터이므로 내적 = 코사인 유사도:
```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
```

**`searchVectorStore(queryEmbedding, { k, filterFilename })`:**
1. 스토어 로드
2. `filterFilename` 있으면 해당 파일 청크만 추림
3. 전체 청크에 유사도 계산 → 정렬 → 상위 k개 반환

---

### `src/lib/poscoGpt.ts`

**POSCO GPT API:**
```
URL: http://aigpt.posco.net/gpgpta01-gpt/gptApi/personalApi
Model: gpt-4o
Auth: Bearer ${POSCO_GPT_KEY}
```

**시스템 프롬프트:**
```
"당신은 산업 설비 유지보수 전문가입니다."
```

**사용자 프롬프트 구조:**
```
[맥락 설명] 설비 알람 코드/고장 증상 관련 질문임을 명시

[지시사항]
- 표 구조 주의 깊게 해석
- 알람 코드/원인/조치 방법 구분
- 없는 사실 지어내지 말 것
- 한국어 답변

[매뉴얼 내용]
[파일: xxx.pdf | p.5]
{청크 텍스트}

---

[파일: yyy.pdf | p.12]
{청크 텍스트}

[질문]
{사용자 질문}

[답변 형식]
1. 증상/알람 의미
2. 원인 및 조치 방법
3. 참고 문서
```

**응답 파싱 (다중 형식 대응):**
```typescript
if (json.choices?.[0]?.message?.content)  // OpenAI 표준 형식
if (json.content)                          // 커스텀 형식
else rawText                               // 텍스트 폴백
```

**소스 중복 제거:** `{filename}::{page}` 키로 Set 관리

---

## 11. 벡터 스토어 및 임베딩

### 빌드 파이프라인

```
PDF 업로드 → POST /api/build-db
  ↓
listPdfFiles() → ["manual1.pdf", "manual2.pdf"]
  ↓
for each PDF:
  parsePdfToChunks(path)
    extractPageTexts():
      pdf-parse with pagerender callback
      → ["page1 text", "page2 text", ...]

    for each page:
      splitTextWithOverlap(pageText, pageNum, filename, idx)
      → [{ text: "...", page: 3, chunkIndex: 42 }, ...]

  for each chunk:
    embedPassage(chunk.text)
    → [0.12, -0.34, ...] (384개 float)

    buildChunk(text, embedding, filename, page, chunkIndex)
    → TextChunk { id: UUID, text, embedding, metadata }

saveVectorStore({ version: 1, builtAt, totalChunks, chunks })
→ data/vector-store/index.json
```

### 검색 파이프라인

```
사용자 질문 → POST /api/chat
  ↓
embedText(question)  // "query: " 접두사 붙임
→ [0.05, 0.89, ...] (384개 float, normalized)
  ↓
searchVectorStore(embedding, { k: 10, filterFilename? })
  → 전체 청크에 dot product 계산
  → 내림차순 정렬
  → 상위 10개 반환
  ↓
callPoscoGpt(question, top10Results)
  → 컨텍스트 조립 (파일명/페이지 태그 포함)
  → GPT API 호출
  → { answer, sources }
```

### 성능 특성
- 벡터 검색: O(N) 선형 스캔 (FAISS/ANN 없음)
- 1000개 청크: ~1ms
- 10000개 청크: ~10ms
- 청크당 임베딩 크기: 384 × 4 bytes = 1536 bytes
- 10000 청크 → 약 15MB JSON (텍스트 포함 시 더 큼)

---

## 12. POSCO GPT 통합

### API 엔드포인트
- URL: `http://aigyt.posco.net/gpgpta01-gpt/gptApi/personalApi` (HTTP, 내부망)
- 인증: `Authorization: Bearer {POSCO_GPT_KEY}` (env var)
- 모델: `gpt-4o`
- 타임아웃: Next.js route `maxDuration = 60초`

### 페이로드 구조
```json
{
  "messages": [
    { "role": "system", "content": "당신은 산업 설비 유지보수 전문가입니다." },
    { "role": "user", "content": "...(컨텍스트 + 질문)..." }
  ],
  "model": "gpt-4o"
}
```

### 멀티턴 대화 미지원
현재 구현은 각 질문을 독립적인 단일 턴으로 처리. 이전 대화 히스토리가 GPT 컨텍스트에 포함되지 않음.

---

## 13. 엔드-투-엔드 요청 흐름

```
[브라우저]
사용자가 "인버터 과열 알람 해결 방법" 입력 후 Enter

1. ChatInput.handleSend()
   → ChatContainer.handleSend("인버터 과열 알람 해결 방법")

2. ChatContainer:
   - userMsg 생성 (timestamp = now)
   - setMessages([...messages, userMsg])
   - onSessionUpdate([...messages, userMsg]) → page.tsx의 handleSessionUpdate
     → 새 세션 생성 또는 기존 세션 업데이트 → localStorage 저장
   - setIsLoading(true) → 타이핑 인디케이터 표시

3. fetch POST /api/chat
   body: { question: "인버터 과열 알람 해결 방법", filterFilename: undefined }

[서버 - api/chat/route.ts]
4. 입력 검증

5. embedText("인버터 과열 알람 해결 방법")
   → getEmbeddingPipeline() (캐시 히트 시 즉시)
   → pipe("query: 인버터 과열 알람 해결 방법", { pooling: "mean", normalize: true })
   → Float32Array(384) → number[]

6. searchVectorStore(embedding, { k: 10 })
   → loadVectorStore() (캐시 히트 시 즉시)
   → 전체 청크에 dot product
   → 상위 10개 SearchResult 반환

7. callPoscoGpt("인버터 과열 알람 해결 방법", results)
   → buildContextFromResults(): 소스 중복 제거, 컨텍스트 문자열 조립
   → buildUserPrompt(): 전체 프롬프트 조립
   → fetch POST aigpt.posco.net (Authorization: Bearer ...)
   → 응답 파싱 → { answer: "1. 증상...", sources: [...] }

8. NextResponse.json({ answer, sources })

[브라우저]
9. response.json() → assistantMsg 생성
   setMessages([...withUser, assistantMsg])
   onSessionUpdate(final) → localStorage 업데이트
   setIsLoading(false) → 인디케이터 제거

10. ChatMessage 컴포넌트 렌더링
    → FormattedContent(answer) → 마크다운 파싱 → React 트리
    → SourceCitation(sources) → 참조 문서 표시
```

---

## 14. 관리자 패널 흐름

### 접근 흐름
```
사용자 → /admin 이동
  → middleware.ts: 쿠키 없음 → redirect /admin/login
  → AdminLoginPage: 비밀번호 입력
  → POST /api/auth/login { password }
  → 성공: Set-Cookie smart_manual_admin=base64(admin:password:timestamp)
  → router.push("/admin")
  → AdminPage (서버 컴포넌트): checkAdminFromCookies()
  → 파일/DB 데이터 수집 → AdminPanel 렌더링
```

### PDF 업로드
```
PdfUploader → 파일 드래그 또는 클릭 선택
→ uploadFiles(FileList)
→ FormData에 파일 추가
→ POST /api/manuals (multipart/form-data)
→ 서버: .pdf 확장자 확인 → data/manuals/ 저장
→ 성공 응답 → onUploaded() → AdminPanel.refreshFiles()
→ ManualList 업데이트
```

### DB 구축
```
BuildDbButton 클릭
→ POST /api/build-db
→ (최대 5분 소요)
→ 완료: { success: true, totalChunks: N, filesProcessed: M }
→ onComplete() → AdminPanel.refreshDbStatus()
→ DB 상태 + 파일 목록 새로고침
```

### 파일 삭제
```
ManualList: Trash2 아이콘 클릭
→ DeleteState { filename, phase: "confirm" }
→ 인라인 확인 UI 표시
→ "삭제" 클릭 → phase: "deleting"
→ DELETE /api/manuals/${encodeURIComponent(filename)}
→ 성공: deleteState = null + onDeleted()
→ 실패: phase: "error" + error message
```

---

## 15. 데이터 디렉토리 및 영속성

| 경로 | 내용 | 생성 주체 |
|---|---|---|
| `data/manuals/` | PDF 파일들 | POST /api/manuals (fs.mkdirSync) |
| `data/vector-store/index.json` | 벡터 스토어 JSON | POST /api/build-db (fs.mkdirSync) |
| `model/Xenova/multilingual-e5-small/` | 로컬 임베딩 모델 | 사전 배치 (Git 외 관리) |
| `public/fonts/PretendardVariable.woff2` | 폰트 파일 | 사전 배치 |

**vector-store/index.json 구조:**
```json
{
  "version": 1,
  "builtAt": "2026-02-28T10:00:00.000Z",
  "totalChunks": 1523,
  "chunks": [
    {
      "id": "uuid-v4",
      "text": "청크 텍스트...",
      "embedding": [0.12, -0.34, ...],  // 384개
      "metadata": { "filename": "xxx.pdf", "page": 5, "chunkIndex": 42 }
    }
  ]
}
```

---

## 16. 의존성

### Runtime
| 패키지 | 버전 | 용도 |
|---|---|---|
| next | 14.2.18 | 풀스택 프레임워크 (App Router) |
| react / react-dom | 18.3.1 | UI 라이브러리 |
| @huggingface/transformers | 3.1.2 | 로컬 ONNX 임베딩 모델 실행 |
| pdf-parse | 1.1.1 | PDF 텍스트 추출 |
| lucide-react | 0.462.0 | 아이콘 라이브러리 |
| clsx | 2.1.1 | 조건부 클래스명 결합 |
| tailwind-merge | 2.5.4 | Tailwind 클래스 충돌 해결 |

### Dev
| 패키지 | 버전 | 용도 |
|---|---|---|
| typescript | 5.6.3 | 타입 시스템 |
| tailwindcss | 3.4.14 | CSS 유틸리티 |
| autoprefixer / postcss | - | Tailwind 빌드 |

---

## 17. 발견된 버그 및 이슈

### 보안

**[보안-1] 쿠키 토큰에 만료 검증 없음**
- `createToken`이 `Date.now()` 타임스탬프를 포함하지만 `validateToken`에서 시간 검증 없음
- 쿠키 `maxAge = 8시간`이 브라우저/서버 측 만료이지 토큰 자체 만료가 아님
- 영향: 쿠키를 탈취하면 이론적으로 계속 사용 가능 (쿠키가 살아있는 동안)
- 내부망 전용이므로 실용적 위험은 낮음

**[보안-2] ADMIN_PASSWORD 기본값 "posco"**
- `.env.local` 미설정 시 `process.env.ADMIN_PASSWORD || "posco"` 기본값 사용
- 내부망 전용이므로 수용 가능하나 배포 시 반드시 변경 필요

### 기능

**[기능-1] 멀티턴 대화 미지원**
- 각 채팅 질문이 독립 API 호출 (이전 대화 컨텍스트 미포함)
- 사용자가 후속 질문을 하면 문맥 없이 새로운 질문으로 처리됨
- 현재 localStorage의 messages 배열은 UI 표시용이고 API에 전달되지 않음

**[기능-2] DB 구축 중 중단 불가**
- `BuildDbButton`에서 빌드 중 취소 기능 없음
- 큰 PDF 처리 시 최대 5분 대기

**[기능-3] 벡터 스토어 전체 재구축만 지원**
- 새 PDF를 추가할 때 기존 청크를 유지하고 새 파일만 추가 불가
- 항상 전체 재처리 필요

**[기능-4] chatKey 기반 세션 전환의 깜빡임**
- 세션 선택 시 `chatKey = id` 변경으로 ChatContainer 전체 언마운트/리마운트
- initialMessages prop을 읽어 초기화하는 방식이라 재렌더링이 깜빡임 없이 동작
- 단, 실제 unmount/remount이므로 스크롤 위치가 상단으로 초기화됨

### 성능

**[성능-1] 임베딩 파이프라인 첫 로드 지연**
- 서버 재시작 후 첫 채팅 요청 시 ONNX 모델 초기화 (~2~5초)
- 이후 요청은 싱글톤 캐시로 즉시 처리

**[성능-2] 벡터 검색 O(N) 선형 스캔**
- FAISS, Annoy 등 ANN(Approximate Nearest Neighbor) 라이브러리 미사용
- 청크 수가 수만 개를 넘으면 성능 저하

**[성능-3] vector-store JSON 전체 메모리 로드**
- `loadVectorStore()`가 전체 JSON을 파싱하여 메모리에 적재
- 100,000 청크 → 수백MB 메모리 점유

---

## 18. 성능 고려 사항

### 현재 최적화 포인트

1. **임베딩 파이프라인 싱글톤**: 모듈 레벨 변수로 서버 생명주기 동안 유지
2. **벡터 스토어 인메모리 캐시**: `_cache` 변수로 파일 재파싱 방지
3. **q8 양자화**: 8-bit 정수 양자화로 모델 크기 및 추론 속도 최적화
4. **청크 필터링**: `filterFilename` 옵션으로 특정 파일만 검색하여 연산 감소

### 현재 병목 지점

1. **PDF 빌드**: 순차 처리 (`for...of` 루프), 대용량 PDF 처리 시 병렬화로 개선 가능
2. **GPT API 응답**: 네트워크 지연 의존 (내부망이므로 일반적으로 빠름)
3. **초기 모델 로드**: 콜드 스타트 시 지연

---

## 19. 핵심 파일 참조표

| 파일 | 역할 | 주요 exports |
|---|---|---|
| `src/types/index.ts` | 전체 공유 타입 정의 | `TextChunk`, `VectorStore`, `ChatMessage`, `ChatSession`, `ManualFile`, `SourceReference` |
| `src/middleware.ts` | Edge 인증 게이트 | `middleware`, `config` |
| `src/lib/auth.ts` | 토큰/쿠키 유틸 | `createToken`, `validateToken`, `isAdminAuthenticated`, `checkAdminFromCookies` |
| `src/lib/embeddings.ts` | HuggingFace 임베딩 | `embedText` (쿼리), `embedPassage` (문서) |
| `src/lib/vectorStore.ts` | 벡터 DB CRUD + 검색 | `loadVectorStore`, `saveVectorStore`, `searchVectorStore`, `buildChunk`, `clearVectorStoreCache` |
| `src/lib/pdfParser.ts` | PDF → 청크 변환 | `parsePdfToChunks`, `getManualsDir`, `listPdfFiles` |
| `src/lib/poscoGpt.ts` | GPT API 호출 | `callPoscoGpt` |
| `src/app/page.tsx` | 메인 채팅 UI + 상태 관리 | `HomePage` (default) |
| `src/app/admin/page.tsx` | 관리자 SSR 페이지 | `AdminPage` (default) |
| `src/app/api/chat/route.ts` | 채팅 API | `POST` |
| `src/app/api/build-db/route.ts` | DB 빌드 API | `POST` |
| `src/components/layout/Sidebar.tsx` | 사이드바 | `Sidebar` |
| `src/components/chat/ChatContainer.tsx` | 채팅 컨테이너 | `ChatContainer` |
| `src/components/chat/ChatMessage.tsx` | 메시지 + 마크다운 | `ChatMessage` |
| `next.config.mjs` | Webpack/Next.js 설정 | ONNX, WebAssembly, 파일 감시 |
| `tailwind.config.ts` | Tailwind 설정 | 커스텀 애니메이션 4개 |

---

*보고서 끝*
