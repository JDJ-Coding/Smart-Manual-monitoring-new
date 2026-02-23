"use client";

import { useState } from "react";
import { Database, Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface Props {
  onComplete: () => void;
}

export function BuildDbButton({ onComplete }: Props) {
  const [status, setStatus] = useState<"idle" | "building" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleBuild = async () => {
    if (status === "building") return;
    setStatus("building");
    setMessage("DB 구축 중… PDF 크기에 따라 수 분이 소요될 수 있습니다.");

    try {
      const res = await fetch("/api/build-db", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setStatus("done");
        setMessage(data.message);
        onComplete();
      } else {
        setStatus("error");
        setMessage(data.message || "DB 구축 실패");
      }
    } catch {
      setStatus("error");
      setMessage("네트워크 오류가 발생했습니다.");
    }
  };

  return (
    <div>
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

      {message && (
        <div className={`mt-3 flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${
          status === "error"
            ? "text-red-400 bg-red-400/10 border-red-400/20"
            : status === "done"
            ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
            : "text-zinc-400 bg-zinc-800 border-zinc-700"
        }`}>
          {status === "done" && <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />}
          {status === "error" && <XCircle size={13} className="flex-shrink-0 mt-0.5" />}
          {status === "building" && <Loader2 size={13} className="animate-spin flex-shrink-0 mt-0.5" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
