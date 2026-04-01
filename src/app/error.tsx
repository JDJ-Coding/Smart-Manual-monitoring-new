"use client";

import { useEffect } from "react";
import { Wrench } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <Wrench size={24} className="text-red-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-zinc-100">오류가 발생했습니다</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            예기치 못한 오류가 발생했습니다.<br />
            페이지를 새로고침하거나 다시 시도해주세요.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            다시 시도
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors border border-zinc-700"
          >
            홈으로
          </a>
        </div>
      </div>
    </div>
  );
}
