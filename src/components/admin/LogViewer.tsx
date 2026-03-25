"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { QueryLog, AdminLog } from "@/types";

type LogType = "query" | "admin";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function minDateStr(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

interface LogModalProps {
  entry: QueryLog | AdminLog | null;
  onClose: () => void;
}

function LogModal({ entry, onClose }: LogModalProps) {
  if (!entry) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h3 className="text-sm font-semibold text-zinc-200">로그 상세</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">
          <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
            {JSON.stringify(entry, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function LogViewer() {
  const [logType, setLogType] = useState<LogType>("query");
  const [date, setDate] = useState(todayStr());
  const [logs, setLogs] = useState<Array<QueryLog | AdminLog>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<QueryLog | AdminLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs?type=${logType}&date=${date}&limit=200`);
      if (!res.ok) throw new Error("로그 불러오기 실패");
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [logType, date]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <>
      <LogModal entry={selectedLog} onClose={() => setSelectedLog(null)} />

      {/* 탭 */}
      <div className="flex gap-1 mb-4">
        {(["query", "admin"] as LogType[]).map((t) => (
          <button
            key={t}
            onClick={() => setLogType(t)}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
              logType === t
                ? "bg-blue-600 text-white"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            )}
          >
            {t === "query" ? "질의 로그" : "관리자 로그"}
          </button>
        ))}
      </div>

      {/* 날짜 선택 */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="date"
          value={date}
          min={minDateStr()}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 px-3 py-1.5
                     focus:outline-none focus:border-blue-500"
        />
        {total > 0 && (
          <span className="text-xs text-zinc-600">
            총 {total}건 (최신 200건 표시)
          </span>
        )}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="text-zinc-500 animate-spin" />
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && logs.length === 0 && (
        <p className="text-xs text-zinc-600 text-center py-10">
          해당 날짜의 로그가 없습니다.
        </p>
      )}

      {/* 테이블 */}
      {!loading && logs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                {logType === "query" ? (
                  <>
                    <th className="text-left text-zinc-500 font-medium pb-2 pr-3 whitespace-nowrap">시각</th>
                    <th className="text-left text-zinc-500 font-medium pb-2 pr-3">질문</th>
                    <th className="text-left text-zinc-500 font-medium pb-2 pr-3 whitespace-nowrap">필터 매뉴얼</th>
                    <th className="text-right text-zinc-500 font-medium pb-2 pr-3 whitespace-nowrap">청크수</th>
                    <th className="text-right text-zinc-500 font-medium pb-2 pr-3 whitespace-nowrap">응답길이</th>
                    <th className="text-left text-zinc-500 font-medium pb-2 pr-3 whitespace-nowrap">도구</th>
                    <th className="text-right text-zinc-500 font-medium pb-2 pr-3 whitespace-nowrap">소요(ms)</th>
                    <th className="text-left text-zinc-500 font-medium pb-2 whitespace-nowrap">오류</th>
                  </>
                ) : (
                  <>
                    <th className="text-left text-zinc-500 font-medium pb-2 pr-3 whitespace-nowrap">시각</th>
                    <th className="text-left text-zinc-500 font-medium pb-2 pr-3 whitespace-nowrap">작업</th>
                    <th className="text-left text-zinc-500 font-medium pb-2 pr-3">상세</th>
                    <th className="text-left text-zinc-500 font-medium pb-2 pr-3 whitespace-nowrap">IP</th>
                    <th className="text-left text-zinc-500 font-medium pb-2 whitespace-nowrap">성공</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {logType === "query"
                ? (logs as QueryLog[]).map((log, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedLog(log)}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2 pr-3 text-zinc-500 whitespace-nowrap">{formatTime(log.timestamp)}</td>
                      <td className="py-2 pr-3 text-zinc-300 max-w-[160px] truncate">
                        {log.question.slice(0, 40)}{log.question.length > 40 ? "…" : ""}
                      </td>
                      <td className="py-2 pr-3 text-zinc-500 whitespace-nowrap max-w-[100px] truncate">
                        {log.filterFilename ?? "전체"}
                      </td>
                      <td className="py-2 pr-3 text-zinc-400 text-right">{log.retrievedChunkCount}</td>
                      <td className="py-2 pr-3 text-zinc-400 text-right">{log.responseLength}</td>
                      <td className="py-2 pr-3 text-zinc-400">
                        {log.toolUsed ? (
                          <span className="text-blue-400">{log.toolNames.join(", ") || "O"}</span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-zinc-400 text-right">{log.durationMs}</td>
                      <td className="py-2">
                        {log.error ? (
                          <span className="text-red-400 truncate max-w-[80px] block">{log.error.slice(0, 20)}</span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                : (logs as AdminLog[]).map((log, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedLog(log)}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2 pr-3 text-zinc-500 whitespace-nowrap">{formatTime(log.timestamp)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className={clsx(
                          "px-1.5 py-0.5 rounded text-xs font-medium",
                          log.action.startsWith("LOGIN") ? "bg-blue-900/40 text-blue-400" :
                          log.action === "LOGOUT" ? "bg-zinc-800 text-zinc-400" :
                          log.action.startsWith("PDF") ? "bg-emerald-900/40 text-emerald-400" :
                          log.action.startsWith("BUILD") ? "bg-amber-900/40 text-amber-400" :
                          "bg-zinc-800 text-zinc-400"
                        )}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-zinc-400 max-w-[200px] truncate">{log.detail}</td>
                      <td className="py-2 pr-3 text-zinc-500 whitespace-nowrap">{log.ip}</td>
                      <td className="py-2">
                        {log.success ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-red-400">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
