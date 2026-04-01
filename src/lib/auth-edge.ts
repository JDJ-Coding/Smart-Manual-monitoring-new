// Edge Runtime 전용 (atob 사용 — Buffer 없음)
// middleware.ts에서만 import

export const SESSION_COOKIE = "smart_manual_admin";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8시간

export function validateTokenEdge(token: string): boolean {
  try {
    const decoded = atob(token);
    const parts = decoded.split(":");
    const role = parts[0];
    const storedPw = parts[1];
    const timestamp = parseInt(parts[2], 10);
    const adminPassword = process.env.ADMIN_PASSWORD || "posco";
    if (role !== "admin" || storedPw !== adminPassword) return false;
    if (!timestamp || Date.now() - timestamp > COOKIE_MAX_AGE * 1000) return false;
    return true;
  } catch {
    return false;
  }
}
