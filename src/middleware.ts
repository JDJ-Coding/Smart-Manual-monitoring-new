import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "smart_manual_admin";

function validateToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    const role = parts[0];
    const storedPw = parts[1];
    const adminPassword = process.env.ADMIN_PASSWORD || "posco";
    return role === "admin" && storedPw === adminPassword;
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
    pathname.startsWith("/api/build-db");

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
  matcher: ["/admin/:path*", "/api/manuals/:path*", "/api/build-db"],
};
