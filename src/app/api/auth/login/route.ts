import { NextRequest, NextResponse } from "next/server";
import { createToken, SESSION_COOKIE, COOKIE_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const adminPassword = process.env.ADMIN_PASSWORD || "posco";

  if (password !== adminPassword) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

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
