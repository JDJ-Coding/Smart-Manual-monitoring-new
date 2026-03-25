import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { appendAdminLog, extractRequestMeta } from "@/lib/adminLogger";

export async function POST(req: NextRequest) {
  const { ip, userAgent } = extractRequestMeta(req);
  appendAdminLog({
    timestamp: new Date().toISOString(),
    action: "LOGOUT",
    detail: "관리자 로그아웃",
    ip,
    userAgent,
    success: true,
    error: null,
  });
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
