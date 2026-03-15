"use client";

import { useState } from "react";
import { Database, Loader2, CheckCircle, XCircle, RefreshCw, AlertTriangle, FileText } from "lucide-react";
import type { ParseReport } from "@/types";

interface Props {
  onComplete: () => void;
}

interface ProgressState {
  file: string;
  fileIndex: number;
  totalFiles: number;
  phase: "parsing" | "embedding";
  fileProgress?: number;
  chunks: number;
}

export function BuildDbButton({ onComplete }: Props) {
  const [status, setStatus] = useState<"idle" | "building" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [report, setReport] = useState<ParseReport[] | null>(null);
  const [showReport, setShowReport] = useState(false);

  const handleBuild = async () => {
    if (status === "building") return;
    setStatus("building");
    setMessage("");
    setProgress(null);
    setReport(null);
    setShowReport(false);

    try {
      const response = await fetch("/api/build-db", { method: "POST" });

      if (!response.body || !response.headers.get("Content-Type")?.includes("text/event-stream")) {
        // Fallback for non-SSE response
        const data = await response.json();
        if (data.success) {
          setStatus("done");
          setMessage(data.message);
          onComplete();
        } else {
          setStatus("error");
          setMessage(data.message ?? "DB 구축 실패");
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          try {
            const evt = JSON.parse(data);

            if (evt.type === "progress") {
              setProgress({
                file: evt.file,
                fileIndex: evt.fileIndex,
                totalFiles: evt.totalFiles,
                phase: evt.phase,
                fileProgress: evt.fileProgress,
                chunks: evt.chunks ?? 0,
              });
            } else if (evt.type === "done") {
              if (evt.success) {
                setStatus("done");
                setMessage(evt.message);
                setReport(evt.report ?? null);
                onComplete();
              } else {
                setStatus("error");
                const errDetail = evt.errors?.length > 0
                  ? `\n오류: ${evt.errors.join(", ")}`
                  : "";
                setMessage((evt.message ?? "DB 구축 실패") + errDetail);
                if (evt.report) setReport(evt.report);
              }
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      setStatus("error");
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setProgress(null);
    }
  };

  const overallPercent = progress
    ? Math.round(((progress.fileIndex - 1) / progress.totalFiles) * 100 +
        ((progress.fileProgress ?? 0) / progress.totalFiles))
    : 0;

  return (
    <div className="space-y-3">
      <button
        onClick={handleBuild}
        disabled={status === "building"}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white
                   px-4 py-2 rounded-lg text-sm font-medium
                   disabled:opacity-60 disabled:cursor-not-allowed
                   transition-all cursor-pointer shadow-sm shadow-blue-600/20"
      >
        {status === "building" ? (
          <Loader2 size={15} className="animate-spin" />
        ) : status === "done" ? (
          <RefreshCw size={15} />
        ) : (
          <Database size={15} />
        )}
        {status === "building" ? "구축 중…" : "DB 전체 재구축"}
      </button>

      {/* 실시간 진행률 표시 */}
      {status === "building" && progress && (
        <div className="space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="truncate max-w-[200px]">
              {progress.phase === "parsing" ? "📄 파싱 중:" : "🔢 임베딩 중:"} {progress.file}
            </span>
            <span className="text-zinc-500 flex-shrink-0 ml-2">
              {progress.fileIndex}/{progress.totalFiles} 파일 · {progress.chunks.toLocaleString()} 청크
            </span>
          </div>
          {/* 전체 진행률 바 */}
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          {/* 파일 내 진행률 바 */}
          {progress.fileProgress !== undefined && (
            <div className="h-1 bg-zinc-800/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400/50 rounded-full transition-all duration-300"
                style={{ width: `${progress.fileProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* 결과 메시지 */}
      {message && status !== "building" && (
        <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${
          status === "error"
            ? "text-red-400 bg-red-400/10 border-red-400/20"
            : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
        }`}>
          {status === "done" && <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />}
          {status === "error" && <XCircle size={13} className="flex-shrink-0 mt-0.5" />}
          <span className="whitespace-pre-line">{message}</span>
        </div>
      )}

      {/* 파싱 리포트 */}
      {report && report.length > 0 && (
        <div>
          <button
            onClick={() => setShowReport(!showReport)}
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors"
          >
            <FileText size={11} />
            {showReport ? "리포트 숨기기" : "파싱 리포트 보기"}
          </button>

          {showReport && (
            <div className="mt-2 rounded-lg border border-zinc-700/60 overflow-hidden animate-fadeIn">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-800/80">
                    <th className="px-3 py-2 text-left text-zinc-400 font-medium">파일</th>
                    <th className="px-3 py-2 text-right text-zinc-400 font-medium">페이지</th>
                    <th className="px-3 py-2 text-right text-zinc-400 font-medium">청크</th>
                    <th className="px-3 py-2 text-right text-zinc-400 font-medium">평균 길이</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-zinc-900/40" : "bg-zinc-800/20"}>
                      <td className="px-3 py-2 text-zinc-300 max-w-[140px]">
                        <div className="flex items-center gap-1.5">
                          {r.hasWarning && (
                            <span title="텍스트 추출 실패 (이미지 PDF?)"><AlertTriangle size={11} className="text-amber-400 flex-shrink-0" /></span>
                          )}
                          <span className="truncate">{r.filename}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-400">{r.totalPages}</td>
                      <td className={`px-3 py-2 text-right font-medium ${r.hasWarning ? "text-amber-400" : "text-zinc-300"}`}>
                        {r.totalChunks}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500">{r.avgChunkLength}자</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
