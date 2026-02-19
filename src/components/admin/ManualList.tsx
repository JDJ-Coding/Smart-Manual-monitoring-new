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
      <p className="text-sm text-gray-400 py-4 text-center">
        등록된 매뉴얼이 없습니다. PDF를 업로드해주세요.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {files.map((file) => (
        <li key={file.filename} className="flex items-center gap-3 py-3">
          <FileText size={18} className="text-[#023E8A] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{file.filename}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {(file.sizeBytes / 1024 / 1024).toFixed(1)} MB &middot;{" "}
              {new Date(file.uploadedAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
          <button
            onClick={() => handleDelete(file.filename)}
            disabled={deletingFile === file.filename}
            className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50 cursor-pointer p-1 rounded"
            title="삭제"
          >
            {deletingFile === file.filename ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
