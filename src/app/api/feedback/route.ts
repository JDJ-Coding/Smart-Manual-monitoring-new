import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { FeedbackEntry } from "@/types";

const FEEDBACK_DIR = path.join(process.cwd(), "data", "feedback");
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, "feedback.jsonl");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, messageIndex, rating, reason } = body;

    if (!sessionId || !rating || !["positive", "negative"].includes(rating)) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const entry: FeedbackEntry = {
      sessionId: String(sessionId),
      messageIndex: Number(messageIndex) || 0,
      rating,
      reason: reason ? String(reason) : undefined,
      timestamp: new Date().toISOString(),
    };

    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
    fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(entry) + "\n", "utf-8");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}

/** 관리자용 피드백 통계 조회 */
export async function GET() {
  try {
    if (!fs.existsSync(FEEDBACK_FILE)) {
      return NextResponse.json({ total: 0, positive: 0, negative: 0, entries: [] });
    }

    const lines = fs.readFileSync(FEEDBACK_FILE, "utf-8")
      .split("\n")
      .filter(Boolean);

    const entries: FeedbackEntry[] = lines.map((line: string) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);

    const positive = entries.filter((e) => e.rating === "positive").length;
    const negative = entries.filter((e) => e.rating === "negative").length;

    // 부정 이유 집계
    const reasonCounts: Record<string, number> = {};
    entries
      .filter((e) => e.rating === "negative" && e.reason)
      .forEach((e) => {
        const r = e.reason!;
        reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
      });

    return NextResponse.json({
      total: entries.length,
      positive,
      negative,
      negativeRate: entries.length > 0 ? Math.round((negative / entries.length) * 100) : 0,
      reasonCounts,
      // 최근 20건 반환
      recentEntries: entries.slice(-20).reverse(),
    });
  } catch {
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
