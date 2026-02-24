import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pretendard = localFont({
  src: "../../public/fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
});

export const metadata: Metadata = {
  title: "Smart Manual Assistant",
  description: "산업 설비 유지보수 매뉴얼 AI 질의응답 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="font-pretendard bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
