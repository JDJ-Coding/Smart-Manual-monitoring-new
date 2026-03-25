import fs from "fs";
import path from "path";
import type { AdminLog } from "@/types";
import type { NextRequest } from "next/server";

const LOGS_DIR = path.join(process.cwd(), "data", "logs");

function getLogPath(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(LOGS_DIR, `${prefix}-${date}.jsonl`);
}

function ensureLogsDir(): void {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export function appendAdminLog(entry: AdminLog): void {
  try {
    ensureLogsDir();
    fs.appendFileSync(getLogPath("admin"), JSON.stringify(entry) + "\n", "utf-8");
  } catch (e) {
    console.error("[adminLogger] 로그 기록 실패:", e);
  }
}

export function cleanOldAdminLogs(retentionDays = 366): void {
  try {
    ensureLogsDir();
    const files = fs.readdirSync(LOGS_DIR).filter((f) =>
      /^admin-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)
    );
    const cutoff = Date.now() - retentionDays * 86400000;
    for (const file of files) {
      const dateStr = file.slice(6, 16);
      const fileDate = new Date(dateStr).getTime();
      if (isNaN(fileDate)) continue;
      if (fileDate < cutoff) fs.unlinkSync(path.join(LOGS_DIR, file));
    }
  } catch (e) {
    console.error("[adminLogger] 로그 정리 실패:", e);
  }
}

export function extractRequestMeta(req: NextRequest): { ip: string; userAgent: string } {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  return { ip, userAgent };
}
