"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, CheckCircle } from "lucide-react";
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
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-[#00B4D8] bg-blue-50"
            : "border-gray-200 hover:border-[#023E8A] hover:bg-gray-50"
        )}
      >
        {isUploading ? (
          <Loader2 className="mx-auto mb-3 text-[#023E8A] animate-spin" size={28} />
        ) : (
          <Upload className="mx-auto mb-3 text-gray-400" size={28} />
        )}
        <p className="text-sm text-gray-600 font-medium">
          {isUploading ? "업로드 중..." : "PDF 파일을 드래그하거나 클릭하여 선택"}
        </p>
        <p className="text-xs text-gray-400 mt-1">여러 파일 동시 업로드 가능</p>
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
        <div className={clsx("mt-3 flex items-center gap-2 text-sm",
          isError ? "text-red-600" : "text-emerald-600"
        )}>
          {!isError && <CheckCircle size={14} />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
