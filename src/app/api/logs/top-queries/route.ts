/**
 * GET /api/logs/top-queries
 *
 * 최근 N일간의 쿼리 로그를 집계하여 가장 자주 묻는 질문 Top 10을 반환한다.
 * 관리자 대시보드의 "자주 묻는 질문" 위젯에 사용.
 *
 * Query params:
 *  - days: 분석할 날짜 수 (기본 7, 최대 30)
 *  - limit: 반환할 항목 수 (기본 10, 최대 20)
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import fs from "fs";
import path from "path";
import type { QueryLog } from "@/types";

const LOGS_DIR = path.join(process.cwd(), "data", "logs");

export interface TopQuery {
  question: string;
  count: number;
  lastAskedAt: string;
  errorRate: number;       // 0.0 ~ 1.0
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const days   = Math.min(parseInt(searchParams.get("days")  ?? "7",  10), 30);
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 20);

  // ── 날짜 범위 내 로그 파일 수집 ─────────────────────────────────────────
  const cutoff = Date.now() - days * 86_400_000;
  const allLogs: QueryLog[] = [];

  if (fs.existsSync(LOGS_DIR)) {
    const files = fs.readdirSync(LOGS_DIR).filter((f) =>
      /^query-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)
    );

    for (const file of files) {
      const dateStr   = file.slice(6, 16);
      const fileDate  = new Date(dateStr).getTime();
      if (isNaN(fileDate) || fileDate < cutoff) continue;

      try {
        const content = fs.readFileSync(path.join(LOGS_DIR, file), "utf-8");
        for (const line of content.split("\n")) {
          if (!line.trim()) continue;
          try {
            allLogs.push(JSON.parse(line) as QueryLog);
          } catch {
            // 파싱 실패 라인 무시
          }
        }
      } catch {
        // 파일 읽기 실패 무시
      }
    }
  }

  if (allLogs.length === 0) {
    return NextResponse.json({ topQueries: [], totalLogs: 0, days });
  }

  // ── 질문 정규화: 소문자 + 앞뒤 공백 제거 ────────────────────────────────
  const normalize = (q: string) => q.trim().toLowerCase();

  // ── 집계: Map<정규화된질문, { count, lastAskedAt, errorCount, originalQuestion }> ─
  const aggregated = new Map<
    string,
    { count: number; lastAskedAt: string; errorCount: number; original: string }
  >();

  for (const log of allLogs) {
    if (!log.question) continue;
    const key = normalize(log.question);
    const existing = aggregated.get(key);
    const isError  = Boolean(log.error);

    if (existing) {
      existing.count++;
      if (log.timestamp > existing.lastAskedAt) existing.lastAskedAt = log.timestamp;
      if (isError) existing.errorCount++;
    } else {
      aggregated.set(key, {
        count:       1,
        lastAskedAt: log.timestamp,
        errorCount:  isError ? 1 : 0,
        original:    log.question.trim(),
      });
    }
  }

  // ── 빈도순 정렬 후 Top N 추출 ────────────────────────────────────────────
  const topQueries: TopQuery[] = Array.from(aggregated.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ original, count, lastAskedAt, errorCount }) => ({
      question:    original,
      count,
      lastAskedAt,
      errorRate:   count > 0 ? parseFloat((errorCount / count).toFixed(2)) : 0,
    }));

  return NextResponse.json({ topQueries, totalLogs: allLogs.length, days });
}
