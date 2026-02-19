"use client";

import { useState } from "react";
import { ManualList } from "./ManualList";
import { PdfUploader } from "./PdfUploader";
import { BuildDbButton } from "./BuildDbButton";
import { LogOut, ArrowLeft, Database, CheckCircle, XCircle } from "lucide-react";
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#023E8A] text-white px-6 py-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold">관리자 패널</h1>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* DB Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Database size={18} className="text-[#023E8A]" />
            벡터 DB 상태
          </h2>
          <div className="flex flex-wrap items-center gap-6 text-sm mb-1">
            <div className="flex items-center gap-2">
              {dbBuilt ? (
                <CheckCircle size={16} className="text-emerald-500" />
              ) : (
                <XCircle size={16} className="text-red-500" />
              )}
              <span className={dbBuilt ? "text-emerald-700 font-medium" : "text-red-600 font-medium"}>
                {dbBuilt ? "구축 완료" : "미구축"}
              </span>
            </div>
            {dbBuilt && (
              <>
                <div className="text-gray-600">
                  총 <span className="font-semibold text-gray-800">{totalChunks.toLocaleString()}</span>개 청크
                </div>
                {dbBuiltAt && (
                  <div className="text-gray-500 text-xs">
                    {new Date(dbBuiltAt).toLocaleString("ko-KR")} 구축
                  </div>
                )}
              </>
            )}
          </div>
          <BuildDbButton onComplete={refreshDbStatus} />
        </div>

        {/* PDF Upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">PDF 업로드</h2>
          <PdfUploader onUploaded={refreshFiles} />
        </div>

        {/* Manual List */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">
            등록된 매뉴얼{" "}
            <span className="text-gray-400 font-normal text-sm">({files.length}개)</span>
          </h2>
          <ManualList files={files} onDeleted={refreshFiles} />
        </div>
      </div>
    </div>
  );
}
