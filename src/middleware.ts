import { NextRequest, NextResponse } from "next/server";
import { validateTokenEdge, SESSION_COOKIE } from "@/lib/auth";

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
  const isAuthenticated = cookie ? validateTokenEdge(cookie.value) : false;

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
