"use client";

import { useState, useEffect } from "react";
import { Users, ThumbsUp, TrendingUp } from "lucide-react";

interface DailyVisitors {
  [date: string]: number;
}

interface FeedbackStats {
  total: number;
  positive: number;
  negative: number;
}

export function StatsPanel() {
  const [visitors, setVisitors] = useState<DailyVisitors>({});
  const [feedback, setFeedback] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/visitors/stats").then((r) => r.json()).catch(() => ({})),
      fetch("/api/feedback").then((r) => r.json()).catch(() => null),
    ]).then(([v, f]) => {
      setVisitors(v.visitors ?? {});
      setFeedback(f);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-xs text-zinc-600">불러오는 중…</p>;

  // 오늘/이번 주/이번 달 방문자 수 계산
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = visitors[today] ?? 0;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekCount = Object.entries(visitors)
    .filter(([d]) => d >= weekStartStr)
    .reduce((sum, [, v]) => sum + v, 0);

  const monthStart = today.slice(0, 7);
  const monthCount = Object.entries(visitors)
    .filter(([d]) => d.startsWith(monthStart))
    .reduce((sum, [, v]) => sum + v, 0);

  // 최근 7일 방문자 추이
  const last7Days: { date: string; label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = i === 0 ? "오늘" : `${d.getMonth() + 1}/${d.getDate()}`;
    last7Days.push({ date: dateStr, label, count: visitors[dateStr] ?? 0 });
  }
  const maxCount = Math.max(...last7Days.map((d) => d.count), 1);

  // 피드백 만족도
  const satisfactionPct =
    feedback && feedback.total > 0
      ? Math.round((feedback.positive / feedback.total) * 100)
      : null;

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
          <Users size={14} className="text-blue-400 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-zinc-100">{todayCount}</p>
          <p className="text-xs text-zinc-500 mt-0.5">오늘 방문자</p>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
          <TrendingUp size={14} className="text-emerald-400 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-zinc-100">{weekCount}</p>
          <p className="text-xs text-zinc-500 mt-0.5">이번 주</p>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
          <Users size={14} className="text-zinc-400 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-zinc-100">{monthCount}</p>
          <p className="text-xs text-zinc-500 mt-0.5">이번 달</p>
        </div>
      </div>

      {/* 피드백 만족도 */}
      {feedback && feedback.total > 0 && (
        <div className="bg-zinc-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ThumbsUp size={13} className="text-emerald-400" />
            <p className="text-xs font-medium text-zinc-300">전체 피드백 만족도</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${satisfactionPct ?? 0}%` }}
              />
            </div>
            <span className="text-sm font-bold text-zinc-200 tabular-nums w-10 text-right">
              {satisfactionPct}%
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">
            총 {feedback.total}건 (긍정 {feedback.positive} / 부정 {feedback.negative})
          </p>
        </div>
      )}

      {/* 최근 7일 방문자 추이 */}
      <div className="bg-zinc-800/50 rounded-xl p-4">
        <p className="text-xs font-medium text-zinc-300 mb-3">최근 7일 방문자 추이</p>
        <div className="space-y-1.5">
          {last7Days.map(({ label, count }) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span className="w-10 text-right text-zinc-500 flex-shrink-0">{label}</span>
              <div className="flex-1 h-4 bg-zinc-900 rounded overflow-hidden">
                {count > 0 && (
                  <div
                    className="h-full bg-blue-600/60 rounded flex items-center pl-1.5 transition-all"
                    style={{ width: `${Math.max((count / maxCount) * 100, 8)}%` }}
                  >
                    <span className="text-[10px] text-blue-200 font-mono">{count}</span>
                  </div>
                )}
              </div>
              {count === 0 && <span className="text-zinc-700 text-[10px]">0</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
