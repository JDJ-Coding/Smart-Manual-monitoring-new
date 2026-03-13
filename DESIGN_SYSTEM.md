# Design System Rules — Smart Manual Assistant
> Figma MCP 통합을 위한 설계 시스템 규칙 문서

---

## 1. Design Tokens

### Color System

**Primary Palette — Zinc (Dark Theme Base)**
```typescript
// tailwind.config.ts 기준 — 실제 사용 클래스
bg-zinc-950   // #09090b — 최상위 배경 (body, 메인 레이아웃)
bg-zinc-900   // #18181b — 2차 배경 (사이드바, 패널)
bg-zinc-800   // #27272a — 카드, AI 메시지 버블, 입력 배경
bg-zinc-700   // #3f3f46 — 활성 상태, 호버 배경
bg-zinc-800/60 등 — opacity modifier 자주 활용
```

**Brand Accent — Blue**
```typescript
// tailwind.config.ts에 커스텀 토큰으로 정의
brand: {
  DEFAULT: "#3b82f6",  // blue-500 — 버튼, 링크, 포커스 링
  hover:   "#2563eb",  // blue-600 — 호버 상태
}
// 사용: bg-brand, hover:bg-brand-hover
// 또는 직접 클래스: bg-blue-600, hover:bg-blue-500
```

**Text Hierarchy**
```
text-zinc-100  // 주요 텍스트 (제목, 메시지 내용)
text-zinc-200  // 2차 텍스트 (부제목, 레이블)
text-zinc-400  // 보조 텍스트 (메타데이터, 힌트)
text-zinc-500  // 비활성 텍스트, 플레이스홀더
text-zinc-600  // 최소 강조 텍스트
```

**Status Colors**
```
text-emerald-400 / bg-emerald-500  // 성공, DB 빌드 완료
text-red-400 / bg-red-500          // 오류, 경고
text-amber-400                      // 주의, 경고 (소프트)
text-blue-300 / text-blue-400       // 링크, 인라인 코드
```

**Border Colors**
```
border-zinc-800/60  // 섹션 구분 (subtle)
border-zinc-700/40  // 카드 테두리 (very subtle)
border-zinc-700     // 명시적 테두리
border-zinc-600     // 포커스/활성 테두리
```

---

### Typography

**Font Family**
```typescript
// 로컬 가변 폰트 (public/fonts/PretendardVariable.woff2)
fontFamily: {
  pretendard: ["var(--font-pretendard)", "-apple-system", "BlinkMacSystemFont", "sans-serif"]
}
// 사용: font-pretendard (body 기본 적용)
// CSS 변수: --font-pretendard (next/font/local로 주입)
```

**Type Scale (실제 사용 패턴)**
```
text-xs    // 12px — 타임스탬프, 배지, 메타
text-sm    // 14px — 메시지 본문, 사이드바 항목
text-base  // 16px — 기본 UI 텍스트
text-lg    // 18px — 섹션 제목
text-xl    // 20px — 페이지 제목
text-2xl+  // 24px+ — 히어로 텍스트 (WelcomeScreen)
```

**Font Weight**
```
font-normal  // 본문 텍스트
font-medium  // 레이블, 버튼
font-semibold // 섹션 헤더
font-bold    // 강조, 마크다운 헤딩
```

---

### Spacing & Layout

**Container Widths**
```
max-w-3xl mx-auto  // 채팅 메시지 영역 (768px)
w-64               // 사이드바 collapsed width
w-72               // 사이드바 expanded (mobile drawer)
```

**Common Spacing Patterns**
```
p-3 / p-4         // 컨테이너 내부 패딩
gap-2 / gap-3     // 아이콘+텍스트 간격
space-y-1         // 리스트 아이템 간격
px-4 py-2         // 버튼 패딩
rounded-lg        // 카드, 버튼 기본 라운드
rounded-xl        // 메시지 버블
rounded-full      // 아이콘 버튼, 배지
```

---

### Animation Tokens

```typescript
// tailwind.config.ts
animation: {
  fadeUp:      "fadeUp 0.4s ease-out forwards",     // 페이지 진입, 초기 콘텐츠
  fadeIn:      "fadeIn 0.3s ease-out forwards",      // 버튼, 스트리밍 메시지
  slideRight:  "slideRight 0.25s ease-out forwards", // 사이드바 콘텐츠
  slideInLeft: "slideInLeft 0.25s ease-out forwards" // 모바일 사이드바 드로어
}
// 사용: animate-fadeUp, animate-fadeIn, animate-slideRight, animate-slideInLeft
```

**Custom CSS (globals.css)**
```css
/* 타이핑 인디케이터 */
.typing-dot { animation: typingDot 1.4s ease-in-out infinite; }
.typing-dot:nth-child(2) { animation-delay: 0.15s; }
.typing-dot:nth-child(3) { animation-delay: 0.30s; }
```

---

## 2. Component Library

### Architecture

- **Framework**: React 18 + Next.js 14.2 (App Router)
- **Language**: TypeScript 5.6 (strict mode)
- **Path alias**: `@/*` → `src/*`
- **No Storybook** — 컴포넌트 문서 없음, 소스 코드 직접 참조

### Component Directory Map

```
src/components/
├── chat/
│   ├── ChatContainer.tsx   # 채팅 전체 레이아웃 + 상태 관리
│   ├── ChatMessage.tsx     # 메시지 버블 (markdown, feedback, copy)
│   ├── ChatInput.tsx       # 자동 확장 textarea + 전송 버튼
│   ├── QuickPanel.tsx      # XL 화면 빠른 질문 패널 (우측)
│   ├── SourceCitation.tsx  # 출처 인용 카드
│   └── WelcomeScreen.tsx   # 초기 화면 (예시 질문 그리드)
├── layout/
│   └── Sidebar.tsx         # 세션 목록 + 매뉴얼 선택 + DB 상태
└── admin/
    ├── AdminPanel.tsx      # 관리자 대시보드 레이아웃
    ├── ManualList.tsx      # PDF 목록
    ├── PdfUploader.tsx     # 드래그앤드롭 업로더
    └── BuildDbButton.tsx   # DB 재구축 버튼
```

### Component Patterns

**Client Components**: `"use client"` 지시어 명시 (모든 chat/, layout/ 컴포넌트)
**Server Components**: admin/ 일부 (AdminPanel)

**조건부 클래스 조합 패턴**:
```typescript
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
// 패턴: clsx()로 조건 처리, twMerge()로 충돌 해결
className={twMerge(clsx("base-class", condition && "conditional-class"))}
```

---

## 3. Styling Approach

**방법론**: Tailwind CSS v3.4 (Utility-First)
- CSS Modules 없음
- Styled Components 없음
- 인라인 스타일 최소화 (동적 값 제외)

**Global Styles** (`src/app/globals.css`):
- Tailwind directives (`@tailwind base/components/utilities`)
- Thin scrollbar (4px, zinc-700 thumb)
- `textarea { resize: none; }` 전역
- `.typing-dot` 애니메이션

**Responsive Breakpoints (Tailwind 기본)**:
```
sm: 640px   // 모바일 최적화 기준
md: 768px   // 사이드바 표시 분기점
lg: 1024px  // 레이아웃 확장
xl: 1280px  // QuickPanel 표시 (`hidden xl:flex`)
```

**Dark Mode**: 단일 다크 테마 고정 (토글 없음, `bg-zinc-950` 기본)

---

## 4. Icon System

**라이브러리**: `lucide-react@0.462.0`

**Import 패턴**:
```typescript
import { Wrench, Settings, Database } from "lucide-react";
// 사용: <Wrench className="w-4 h-4 text-zinc-400" />
```

**크기 규칙**:
```
w-3 h-3  // 매우 작은 인디케이터
w-4 h-4  // 기본 아이콘 (버튼 내, 인라인)
w-5 h-5  // 사이드바 네비게이션
w-6 h-6  // 중간 강조
w-8 h-8  // 큰 액션 버튼
w-12 h-12 // 히어로 아이콘 (WelcomeScreen 로고)
```

**아이콘 색상 규칙**:
```
text-zinc-500  // 비활성 아이콘
text-zinc-400  // 기본 아이콘
text-zinc-300  // 활성/호버 아이콘
text-blue-400  // 브랜드 액션 아이콘
text-emerald-400 // 성공 상태 아이콘
text-red-400   // 오류 상태 아이콘
```

---

## 5. Asset Management

**폰트**: `public/fonts/PretendardVariable.woff2` (로컬, gitignore 제외)
- `next/font/local`로 로드, CSS 변수 `--font-pretendard` 주입

**이미지**: 현재 없음 (순수 Tailwind + Lucide 아이콘 기반 UI)

**CDN**: 없음 (완전 로컬/사내망 전용)

---

## 6. Figma → Code 변환 규칙

### 색상 매핑

| Figma 색상값 | Tailwind 클래스 |
|-------------|----------------|
| `#09090b` | `bg-zinc-950` |
| `#18181b` | `bg-zinc-900` |
| `#27272a` | `bg-zinc-800` |
| `#3f3f46` | `bg-zinc-700` |
| `#3b82f6` | `bg-blue-500` / `bg-brand` |
| `#2563eb` | `bg-blue-600` / `bg-brand-hover` |
| `#f4f4f5` | `text-zinc-100` |
| `#e4e4e7` | `text-zinc-200` |
| `#a1a1aa` | `text-zinc-400` |
| `#71717a` | `text-zinc-500` |

### 컴포넌트 매핑 (Figma 프레임 → 파일)

| Figma 프레임 | 코드 경로 |
|-------------|-----------|
| Chat Interface | `src/components/chat/ChatContainer.tsx` |
| Message Bubble (AI) | `src/components/chat/ChatMessage.tsx` |
| Message Bubble (User) | `src/components/chat/ChatMessage.tsx` |
| Input Bar | `src/components/chat/ChatInput.tsx` |
| Sidebar | `src/components/layout/Sidebar.tsx` |
| Welcome Screen | `src/components/chat/WelcomeScreen.tsx` |
| Quick Panel | `src/components/chat/QuickPanel.tsx` |
| Source Citation | `src/components/chat/SourceCitation.tsx` |
| Admin Dashboard | `src/components/admin/AdminPanel.tsx` |

### 코드 생성 지침

1. **항상 Tailwind 클래스 사용** — 인라인 스타일 생성 금지 (동적 값 제외)
2. **`font-pretendard` 클래스** — 텍스트 요소에 필요 시 명시
3. **아이콘은 lucide-react** — 새 아이콘 라이브러리 추가 금지
4. **`clsx` + `twMerge` 패턴** — 조건부 클래스 조합 시 사용
5. **`"use client"` 필수** — 상태/이벤트 있는 컴포넌트 최상단에 명시
6. **다크 테마 고정** — `dark:` prefix 불필요, 모든 클래스는 다크 기준
7. **Absolute positioning 최소화** — Flexbox/Grid 레이아웃 우선
8. **Animation 사용 시** — `animate-fadeUp`, `animate-fadeIn` 등 정의된 토큰 활용

### 메시지 버블 패턴

```tsx
// AI 메시지
<div className="bg-zinc-800 rounded-xl rounded-tl-sm px-4 py-3 text-zinc-200 text-sm">

// 사용자 메시지
<div className="bg-blue-600 rounded-xl rounded-tr-sm px-4 py-3 text-white text-sm">
```

### 버튼 패턴

```tsx
// 주요 액션 버튼
<button className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg font-medium transition-colors">

// 아이콘 버튼
<button className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">

// 비활성 버튼
<button disabled className="bg-zinc-700 text-zinc-500 cursor-not-allowed px-4 py-2 rounded-lg">
```

### 입력 필드 패턴

```tsx
<textarea className="w-full bg-zinc-800 border border-zinc-700/60 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-none text-sm" />
```

### 카드/패널 패턴

```tsx
<div className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-4">
```

---

## 7. Project Structure (Figma 통합 관련)

```
Smart-Manual-monitoring-new/
├── src/
│   ├── app/
│   │   ├── globals.css          ← 전역 스타일 (애니메이션 추가 시)
│   │   └── layout.tsx           ← 폰트 설정 (변경 불필요)
│   ├── components/              ← Figma → 코드 변환 대상
│   └── types/index.ts           ← 컴포넌트 props 타입 정의
├── public/fonts/                ← Pretendard 폰트 파일
├── tailwind.config.ts           ← 토큰 추가 시 이 파일 수정
└── DESIGN_SYSTEM.md             ← 이 문서
```

**새 컴포넌트 추가 규칙**:
- 채팅 관련 → `src/components/chat/`
- 레이아웃 관련 → `src/components/layout/`
- 관리자 관련 → `src/components/admin/`
- 새 디렉터리 생성 지양
