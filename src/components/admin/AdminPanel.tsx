"use client";

import { useState } from "react";
import { ManualList } from "./ManualList";
import { PdfUploader } from "./PdfUploader";
import { BuildDbButton } from "./BuildDbButton";
import { LogOut, ArrowLeft, Database, CheckCircle, XCircle, Settings, Upload, BookOpen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ManualFile } from "@/types";

interface Props {
  files: ManualFile[];
  dbBuilt: boolean;
  totalChunks: number;
  dbBuiltAt: string | null;
}

export function AdminPanel({ files: initialFiles, dbBuilt: initialDbBuilt, totalChunks: initialChunks, dbBuiltAt }: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [dbBuilt, setDbBuilt] = useState(initialDbBuilt);
  const [totalChunks, setTotalChunks] = useState(initialChunks);
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const refreshFiles = async () => {
    const res = await fetch("/api/manuals");
    const data = await res.json();
    setFiles(data.files ?? []);
  };

  const refreshDbStatus = async () => {
    const res = await fetch("/api/db-status");
    const data = await res.json();
    setDbBuilt(data.built ?? false);
    setTotalChunks(data.totalChunks ?? 0);
    await refreshFiles();
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-900/80 backdrop-blur border-b border-zinc-800 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 -ml-1 rounded-lg hover:bg-zinc-800">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
              <Settings size={13} className="text-white" />
            </div>
            <h1 className="text-sm font-semibold text-zinc-100">관리자 패널</h1>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors
                     px-3 py-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer"
        >
          <LogOut size={14} />
          로그아웃
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        {/* DB Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Database size={15} className="text-blue-500" />
            벡터 DB 상태
          </h2>

          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              {dbBuilt ? (
                <CheckCircle size={15} className="text-emerald-400" />
              ) : (
                <XCircle size={15} className="text-red-400" />
              )}
              <span className={dbBuilt ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                {dbBuilt ? "구축 완료" : "미구축"}
              </span>
            </div>
            {dbBuilt && (
              <>
                <div className="text-sm text-zinc-400">
                  <span className="font-semibold text-zinc-200">{totalChunks.toLocaleString()}</span>
                  <span className="text-zinc-500 ml-1">청크</span>
                </div>
                {dbBuiltAt && (
                  <div className="text-xs text-zinc-600 bg-zinc-800 px-2.5 py-1 rounded-full">
                    {new Date(dbBuiltAt).toLocaleString("ko-KR")} 구축
                  </div>
                )}
              </>
            )}
          </div>

          <BuildDbButton onComplete={refreshDbStatus} />
        </div>

        {/* PDF Upload */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Upload size={15} className="text-blue-500" />
            PDF 업로드
          </h2>
          <PdfUploader onUploaded={refreshFiles} />
        </div>

        {/* Manual List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <BookOpen size={15} className="text-blue-500" />
            등록된 매뉴얼
            <span className="text-zinc-600 font-normal text-xs ml-1">({files.length}개)</span>
          </h2>
          <ManualList files={files} onDeleted={refreshFiles} />
        </div>
      </div>
    </div>
  );
}
