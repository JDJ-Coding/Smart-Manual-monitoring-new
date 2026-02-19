"use client";

import { useState } from "react";
import { Database, Loader2, CheckCircle, XCircle } from "lucide-react";

interface Props {
  onComplete: () => void;
}

export function BuildDbButton({ onComplete }: Props) {
  const [status, setStatus] = useState<"idle" | "building" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleBuild = async () => {
    if (status === "building") return;
    setStatus("building");
    setMessage("DB 구축 중... PDF 크기에 따라 수 분이 소요될 수 있습니다.");

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
    <div className="mt-4">
      <button
        onClick={handleBuild}
        disabled={status === "building"}
        className="flex items-center gap-2 bg-[#023E8A] text-white px-5 py-2.5 rounded-lg
                   text-sm font-medium hover:bg-[#0077B6] disabled:opacity-60 disabled:cursor-not-allowed
                   transition-colors cursor-pointer"
      >
        {status === "building" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Database size={16} />
        )}
        {status === "building" ? "구축 중..." : "DB 전체 재구축"}
      </button>

      {message && (
        <div className={`mt-3 flex items-start gap-2 text-sm ${
          status === "error"
            ? "text-red-600"
            : status === "done"
            ? "text-emerald-600"
            : "text-gray-500"
        }`}>
          {status === "done" && <CheckCircle size={15} className="mt-0.5 flex-shrink-0" />}
          {status === "error" && <XCircle size={15} className="mt-0.5 flex-shrink-0" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
