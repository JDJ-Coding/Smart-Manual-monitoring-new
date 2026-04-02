"use client";

import { useEffect } from "react";

/**
 * 관리자 레이아웃
 * - admin 영역 밖으로 나갈 때(클라이언트 언마운트) 자동 로그아웃
 * - 로그인 직후 리다이렉트는 예외 처리 (sessionStorage 플래그)
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    return () => {
      // 로그인 직후 리다이렉트인 경우 로그아웃하지 않음
      const isLoginRedirect = sessionStorage.getItem("_adminLoginRedirect");
      if (isLoginRedirect) {
        sessionStorage.removeItem("_adminLoginRedirect");
        return;
      }
      // admin 밖으로 이동 시 자동 로그아웃
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    };
  }, []);

  return <>{children}</>;
}
