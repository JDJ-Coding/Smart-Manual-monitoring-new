"use client";

import { useEffect } from "react";

/**
 * 관리자 레이아웃
 * - 관리자 페이지에서 나갈 때(언마운트) 자동 로그아웃
 *   → 다음 방문 시 반드시 재인증 필요
 * - beforeunload: 탭 닫기·브라우저 이동 시에도 로그아웃
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 탭 닫기 / URL 직접 이동 시 로그아웃 (비동기 전송)
      navigator.sendBeacon("/api/auth/logout");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Next.js 클라이언트 라우팅으로 admin 밖으로 나갈 때 로그아웃
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    };
  }, []);

  return <>{children}</>;
}
