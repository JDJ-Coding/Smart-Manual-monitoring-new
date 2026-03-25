import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import fs from "fs";
import path from "path";

const LOGS_DIR = path.join(process.cwd(), "data", "logs");

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const limitParam = parseInt(searchParams.get("limit") ?? "200", 10);
  const limit = Math.min(isNaN(limitParam) ? 200 : limitParam, 500);

  if (type !== "query" && type !== "admin") {
    return NextResponse.json({ error: "type 파라미터는 'query' 또는 'admin'이어야 합니다." }, { status: 400 });
  }

  const filePath = path.join(LOGS_DIR, `${type}-${date}.jsonl`);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ logs: [], total: 0 });
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const parsed = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const reversed = parsed.reverse();
    const sliced = reversed.slice(0, limit);

    return NextResponse.json({ logs: sliced, total: parsed.length });
  } catch (e) {
    console.error("[logs/route] 로그 파일 읽기 실패:", e);
    return NextResponse.json({ logs: [], total: 0 });
  }
}
