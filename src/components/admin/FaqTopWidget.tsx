"use client";

/**
 * FaqTopWidget — 자주 묻는 질문 Top 10
 *
 * /api/logs/top-queries 를 호출하여 최근 N일간 가장 빈도 높은 질문을 표시한다.
 * - 빈도 바 차트 (최댓값 기준 상대 너비)
 * - 에러율 배지 (30% 이상이면 경고 표시)
 * - "빠른 질문에 등록" 버튼으로 quick-questions 와 연동 가능하게 준비
 */

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import type { TopQuery } from "@/app/api/logs/top-queries/route";

interface Props {
  days?: number;
  limit?: number;
}

export function FaqTopWidget({ days = 7, limit = 10 }: Props) {
  const [data, setData] = useState<{
    topQueries: TopQuery[];
    totalLogs: number;
    days: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(days);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/logs/top-queries?days=${selectedDays}&limit=${limit}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // 조용히 실패 — 로그 없음으로 처리
    } finally {
      setLoading(false);
    }
  }, [selectedDays, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxCount = data?.topQueries?.[0]?.count ?? 1;

  return (
    <div className="bg-zinc-800/50 rounded-xl p-4 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-brand" />
          <p className="text-xs font-medium text-zinc-300">자주 묻는 질문 Top {limit}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 기간 선택 */}
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(Number(e.target.value))}
            className="text-xs bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-400 focus:outline-none focus:border-brand"
          >
            <option value={3}>최근 3일</option>
            <option value={7}>최근 7일</option>
            <option value={14}>최근 14일</option>
            <option value={30}>최근 30일</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40"
            title="새로고침"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 요약 */}
      {data && (
        <p className="text-[11px] text-zinc-600">
          최근 {data.days}일간 총 <span className="text-zinc-400 font-medium">{data.totalLogs.toLocaleString()}</span>건의 질의 분석
        </p>
      )}

      {/* 질문 목록 */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 bg-zinc-700/40 rounded animate-pulse" />
          ))}
        </div>
      ) : !data || data.topQueries.length === 0 ? (
        <p className="text-xs text-zinc-600 py-4 text-center">
          분석할 질의 로그가 없습니다.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {data.topQueries.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 text-xs group">
              {/* 순위 번호 */}
              <span className="w-4 flex-shrink-0 text-center text-[10px] text-zinc-600 font-mono tabular-nums">
                {idx + 1}
              </span>

              {/* 질문 + 빈도 바 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span
                    className="truncate text-zinc-300 group-hover:text-zinc-100 transition-colors"
                    title={item.question}
                  >
                    {item.question}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* 에러율 경고: 30% 이상이면 amber 배지 */}
                    {item.errorRate >= 0.3 && (
                      <span
                        className="flex items-center gap-0.5 text-[10px] text-status-warning"
                        title={`에러율 ${Math.round(item.errorRate * 100)}%`}
                      >
                        <AlertTriangle size={9} />
                        {Math.round(item.errorRate * 100)}%
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-500 tabular-nums">
                      {item.count}회
                    </span>
                  </div>
                </div>
                {/* 상대 빈도 바 */}
                <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand/60 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max((item.count / maxCount) * 100, 4)}%`,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
