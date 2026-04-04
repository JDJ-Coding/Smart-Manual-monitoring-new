import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pretendard: [
          "var(--font-pretendard)",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
      colors: {
        // ── Brand ──────────────────────────────────────────────────────────
        brand: {
          DEFAULT: "#3b82f6",
          hover:   "#2563eb",
          light:   "#93c5fd",
          subtle:  "#1e3a5f",
        },
        // ── Semantic Status (DESIGN_SYSTEM.md 기반) ────────────────────────
        // 사용 예: text-status-danger, bg-status-warning/10, border-status-success
        // 색상 + 형태(아이콘) 이중 인코딩으로 색각 이상 접근성 보장
        status: {
          danger:   "#ef4444",   // 위험 — 빨강 (red-500)
          warning:  "#f59e0b",   // 주의 — 노랑 (amber-500)
          success:  "#10b981",   // 정상/완료 — 초록 (emerald-500)
          info:     "#3b82f6",   // 정보 — 파랑 (blue-500)
        },
        // ── Surface (다크 테마 표면 계층) ──────────────────────────────────
        // 사용 예: bg-surface-base, border-surface-border
        surface: {
          base:    "#09090b",   // zinc-950 — 최하단 배경
          raised:  "#18181b",   // zinc-900 — 카드/패널
          overlay: "#27272a",   // zinc-800 — 팝업/드롭다운
          border:  "#3f3f46",   // zinc-700 — 테두리
          muted:   "#52525b",   // zinc-600 — 비활성 텍스트
        },
      },
      animation: {
        fadeUp:     "fadeUp 0.4s ease-out forwards",
        fadeIn:     "fadeIn 0.3s ease-out forwards",
        slideRight: "slideRight 0.25s ease-out forwards",
        slideInLeft: "slideInLeft 0.25s ease-out forwards",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideRight: {
          "0%":   { opacity: "0", transform: "translateX(-8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%":   { opacity: "0", transform: "translateX(-100%)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
