import { NextRequest, NextResponse } from "next/server";
import { createToken, SESSION_COOKIE, COOKIE_MAX_AGE } from "@/lib/auth";
import { appendAdminLog, extractRequestMeta } from "@/lib/adminLogger";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "posco";
  const { ip, userAgent } = extractRequestMeta(req);

  if (username !== adminUsername || password !== adminPassword) {
    appendAdminLog({
      timestamp: new Date().toISOString(),
      action: "LOGIN_FAIL",
      detail: "비밀번호 불일치",
      ip,
      userAgent,
      success: false,
      error: "비밀번호 불일치",
    });
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  appendAdminLog({
    timestamp: new Date().toISOString(),
    action: "LOGIN_SUCCESS",
    detail: "관리자 로그인 성공",
    ip,
    userAgent,
    success: true,
    error: null,
  });

  const token = createToken(password);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "strict",
  });

  return response;
}
