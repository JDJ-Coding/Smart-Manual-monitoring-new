import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "smart_manual_admin";
const COOKIE_MAX_AGE_MS = 60 * 60 * 8 * 1000; // 8시간

function validateToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    const role = parts[0];
    const storedPw = parts[1];
    const timestamp = parseInt(parts[2], 10);
    const adminPassword = process.env.ADMIN_PASSWORD || "posco";
    if (role !== "admin" || storedPw !== adminPassword) return false;
    // 토큰 발급 시각 기반 만료 검증 (8시간)
    if (!timestamp || Date.now() - timestamp > COOKIE_MAX_AGE_MS) return false;
    return true;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi =
    (pathname.startsWith("/api/manuals") && method !== "GET") ||
    pathname.startsWith("/api/build-db") ||
    (pathname.startsWith("/api/quick-questions") && method === "POST") ||
    pathname.startsWith("/api/logs");

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE);
  const isAuthenticated = cookie ? validateToken(cookie.value) : false;

  if (!isAuthenticated) {
    if (isAdminApi) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/manuals/:path*", "/api/build-db", "/api/quick-questions", "/api/logs"],
};
