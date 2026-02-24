"use client";

import { useState } from "react";
import { Trash2, FileText, Loader2 } from "lucide-react";
import type { ManualFile } from "@/types";

interface Props {
  files: ManualFile[];
  onDeleted: () => void;
}

export function ManualList({ files, onDeleted }: Props) {
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const handleDelete = async (filename: string) => {
    if (!confirm(`"${filename}"을 삭제하시겠습니까?`)) return;

    setDeletingFile(filename);
    try {
      const res = await fetch(`/api/manuals/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "삭제에 실패했습니다.");
      }
      onDeleted();
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 오류가 발생했습니다.");
    } finally {
      setDeletingFile(null);
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
    <ul className="space-y-1">
      {files.map((file) => (
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
            onClick={() => handleDelete(file.filename)}
            disabled={deletingFile === file.filename}
            className="text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50
                       cursor-pointer p-1.5 rounded-lg hover:bg-red-400/10
                       opacity-0 group-hover:opacity-100"
            title="삭제"
          >
            {deletingFile === file.filename ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
