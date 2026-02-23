"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Loader2, CheckCircle, XCircle } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  onUploaded: () => void;
}

export function PdfUploader({ onUploaded }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (message && !isError) {
      timerRef.current = setTimeout(() => setMessage(""), 3000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, isError]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setMessage("");
    setIsError(false);

    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/manuals", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || "업로드 완료");
        onUploaded();
      } else {
        setIsError(true);
        setMessage(data.error || "업로드 실패");
      }
    } catch {
      setIsError(true);
      setMessage("업로드 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          isDragging
            ? "border-blue-500 bg-blue-500/5"
            : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/40"
        )}
      >
        <div className={clsx(
          "w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center",
          isDragging ? "bg-blue-500/20" : "bg-zinc-800"
        )}>
          {isUploading ? (
            <Loader2 className="text-blue-400 animate-spin" size={20} />
          ) : (
            <Upload className={clsx("transition-colors", isDragging ? "text-blue-400" : "text-zinc-500")} size={20} />
          )}
        </div>
        <p className="text-sm text-zinc-400 font-medium">
          {isUploading ? "업로드 중…" : "PDF 드래그 또는 클릭하여 선택"}
        </p>
        <p className="text-xs text-zinc-600 mt-1">여러 파일 동시 업로드 가능</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => uploadFiles(e.target.files)}
      />

      {message && (
        <div className={clsx(
          "mt-3 flex items-center gap-2 text-sm rounded-lg px-3 py-2",
          isError
            ? "text-red-400 bg-red-400/10 border border-red-400/20"
            : "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20"
        )}>
          {isError ? <XCircle size={14} /> : <CheckCircle size={14} />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
