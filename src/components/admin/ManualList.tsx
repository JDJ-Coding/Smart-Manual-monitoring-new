"use client";

import { useState } from "react";
import { Trash2, FileText, Loader2, AlertTriangle, X, Check } from "lucide-react";
import type { ManualFile } from "@/types";

interface Props {
  files: ManualFile[];
  onDeleted: () => void;
}

interface DeleteState {
  filename: string;
  phase: "confirm" | "deleting" | "error";
  error?: string;
}

export function ManualList({ files, onDeleted }: Props) {
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);

  const requestDelete = (filename: string) => {
    setDeleteState({ filename, phase: "confirm" });
  };

  const cancelDelete = () => {
    setDeleteState(null);
  };

  const confirmDelete = async () => {
    if (!deleteState) return;
    const { filename } = deleteState;
    setDeleteState({ filename, phase: "deleting" });

    try {
      const res = await fetch(`/api/manuals/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "삭제에 실패했습니다.");
      }
      setDeleteState(null);
      onDeleted();
    } catch (err) {
      setDeleteState({
        filename,
        phase: "error",
        error: err instanceof Error ? err.message : "삭제 오류가 발생했습니다.",
      });
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText size={28} className="text-zinc-700 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">등록된 매뉴얼이 없습니다.</p>
        <p className="text-xs text-zinc-600 mt-0.5">위에서 PDF를 업로드해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Inline delete confirmation */}
      {deleteState && deleteState.phase === "confirm" && (
        <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-red-400/10 border border-red-400/20 animate-fadeIn">
          <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-300 font-medium">삭제 확인</p>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              &quot;{deleteState.filename}&quot;을(를) 삭제하시겠습니까?
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={confirmDelete}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                         bg-red-500 hover:bg-red-400 text-white transition-colors"
            >
              <Check size={11} />
              삭제
            </button>
            <button
              onClick={cancelDelete}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                         bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              <X size={11} />
              취소
            </button>
          </div>
        </div>
      )}

      {/* Error feedback */}
      {deleteState && deleteState.phase === "error" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-400/10 border border-red-400/20 animate-fadeIn">
          <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400 flex-1">{deleteState.error}</p>
          <button onClick={cancelDelete} className="text-zinc-500 hover:text-zinc-300">
            <X size={13} />
          </button>
        </div>
      )}

      <ul className="space-y-1">
        {files.map((file) => {
          const isDeleting = deleteState?.filename === file.filename && deleteState.phase === "deleting";
          return (
            <li
              key={file.filename}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700/40 group"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-600/15 flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{file.filename}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {(file.sizeBytes / 1024 / 1024).toFixed(1)} MB &middot;{" "}
                  {new Date(file.uploadedAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
              <button
                onClick={() => requestDelete(file.filename)}
                disabled={isDeleting || deleteState?.phase === "deleting"}
                className="text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50
                           cursor-pointer p-1.5 rounded-lg hover:bg-red-400/10
                           opacity-0 group-hover:opacity-100"
                aria-label={`${file.filename} 삭제`}
                title="삭제"
              >
                {isDeleting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
