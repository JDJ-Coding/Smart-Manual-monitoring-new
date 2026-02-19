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
        primary: {
          DEFAULT: "#023E8A",
          light: "#0077B6",
          50: "#eff6ff",
        },
        secondary: {
          DEFAULT: "#00B4D8",
          light: "#90E0EF",
        },
        sidebar: "#111827",
      },
      animation: {
        fadeUp: "fadeUp 0.6s ease-out",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
