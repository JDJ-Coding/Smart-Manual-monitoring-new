import { NextRequest } from "next/server";
import { cookies } from "next/headers";

const SESSION_COOKIE = "smart_manual_admin";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export function createToken(password: string): string {
  return Buffer.from(`admin:${password}:${Date.now()}`).toString("base64");
}

export function validateToken(token: string): boolean {
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

export function isAdminAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get(SESSION_COOKIE);
  if (!cookie) return false;
  return validateToken(cookie.value);
}

export async function checkAdminFromCookies(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  if (!cookie) return false;
  return validateToken(cookie.value);
}

export { SESSION_COOKIE, COOKIE_MAX_AGE };
