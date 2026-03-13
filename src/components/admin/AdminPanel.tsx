"use client";

import { useState, useEffect } from "react";
import { ManualList } from "./ManualList";
import { PdfUploader } from "./PdfUploader";
import { BuildDbButton } from "./BuildDbButton";
import { ChunkViewer } from "./ChunkViewer";
import {
  LogOut, ArrowLeft, Database, CheckCircle, XCircle, Settings,
  Upload, BookOpen, Layers, MessageSquare, Zap, Wrench, RefreshCw,
  AlertTriangle, Thermometer, FileText, Plus, Trash2, GripVertical,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { ManualFile, QuickQuestion } from "@/types";

interface Props {
  files: ManualFile[];
  dbBuilt: boolean;
  totalChunks: number;
  dbBuiltAt: string | null;
}

type AdminTab = "files" | "chunks" | "feedback" | "quickquestions";

const AVAILABLE_ICONS = ["Zap", "Wrench", "RefreshCw", "AlertTriangle", "Thermometer", "FileText", "Settings"];
const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Wrench, RefreshCw, AlertTriangle, Thermometer, FileText, Settings,
};

function FeedbackStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-xs text-zinc-600">불러오는 중…</p>;
  if (!stats) return <p className="text-xs text-zinc-600">데이터 없음</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "총 피드백", value: stats.total, color: "text-zinc-300" },
          { label: "좋아요", value: stats.positive, color: "text-emerald-400" },
          { label: "싫어요", value: stats.negative, color: "text-red-400" },
        ].map((item) => (
          <div key={item.label} className="bg-zinc-800/60 rounded-xl px-4 py-3 text-center border border-zinc-700/40">
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {stats.total > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-zinc-500">부정 응답 비율</span>
            <span className="text-red-400 font-medium">{stats.negativeRate}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500/70 rounded-full transition-all"
              style={{ width: `${stats.negativeRate}%` }}
            />
          </div>
        </div>
      )}

      {stats.reasonCounts && Object.keys(stats.reasonCounts).length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-2">부정 이유 분포</p>
          <div className="space-y-1.5">
            {Object.entries(stats.reasonCounts as Record<string, number>)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([reason, count]) => (
                <div key={reason} className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 flex-1">{reason}</span>
                  <span className="text-zinc-500 font-medium">{count as number}건</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {stats.total === 0 && (
        <p className="text-xs text-zinc-600 text-center py-4">아직 피드백이 없습니다.</p>
      )}
    </div>
  );
}

function QuickQuestionsEditor() {
  const [questions, setQuestions] = useState<QuickQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quick-questions")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.questions)) setQuestions(data.questions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addQuestion = () => {
    if (questions.length >= 8) return;
    setQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: "", tag: "", icon: "FileText" },
    ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, field: keyof QuickQuestion, value: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/quick-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-xs text-zinc-600">불러오는 중…</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">빠른 질문 패널에 표시될 예시 질문을 편집합니다. (최대 8개)</p>
      <div className="space-y-2">
        {questions.map((q) => {
          const Icon = ICON_MAP[q.icon] ?? FileText;
          return (
            <div key={q.id} className="flex items-start gap-2 bg-zinc-800/40 rounded-lg p-3 border border-zinc-700/40">
              <GripVertical size={14} className="text-zinc-700 mt-1 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={q.icon}
                    onChange={(e) => updateQuestion(q.id, "icon", e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-400 px-2 py-1 focus:outline-none focus:border-blue-500"
                  >
                    {AVAILABLE_ICONS.map((icon) => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                  <input
                    value={q.tag}
                    onChange={(e) => updateQuestion(q.id, "tag", e.target.value)}
                    placeholder="태그 (예: 알람 코드)"
                    className="flex-shrink-0 w-28 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300
                               px-2 py-1 focus:outline-none focus:border-blue-500 placeholder:text-zinc-700"
                  />
                  <div className="flex items-center px-1">
                    <Icon size={12} className="text-blue-500" />
                  </div>
                </div>
                <input
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, "text", e.target.value)}
                  placeholder="질문 내용"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300
                             px-2 py-1.5 focus:outline-none focus:border-blue-500 placeholder:text-zinc-700"
                />
              </div>
              <button
                onClick={() => removeQuestion(q.id)}
                className="p-1 text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0 mt-1"
                title="삭제"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={addQuestion}
          disabled={questions.length >= 8}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={12} />
          질문 추가 ({questions.length}/8)
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium disabled:opacity-60 transition-all"
        >
          {saved ? "저장됨 ✓" : saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}

export function AdminPanel({
  files: initialFiles,
  dbBuilt: initialDbBuilt,
  totalChunks: initialChunks,
  dbBuiltAt,
}: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [dbBuilt, setDbBuilt] = useState(initialDbBuilt);
  const [totalChunks, setTotalChunks] = useState(initialChunks);
  const [activeTab, setActiveTab] = useState<AdminTab>("files");
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

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "files", label: "파일 관리", icon: BookOpen },
    { id: "chunks", label: "청크 미리보기", icon: Layers },
    { id: "feedback", label: "피드백", icon: MessageSquare },
    { id: "quickquestions", label: "빠른 질문", icon: Zap },
  ];

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

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
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

        {/* Tab navigation */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all",
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                )}
              >
                <Icon size={12} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "files" && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
                <Upload size={15} className="text-blue-500" />
                PDF 업로드
              </h2>
              <PdfUploader onUploaded={refreshFiles} />
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
                <BookOpen size={15} className="text-blue-500" />
                등록된 매뉴얼
                <span className="text-zinc-600 font-normal text-xs ml-1">({files.length}개)</span>
              </h2>
              <ManualList files={files} onDeleted={refreshFiles} />
            </div>
          </>
        )}

        {activeTab === "chunks" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
              <Layers size={15} className="text-blue-500" />
              청크 미리보기
              <span className="text-zinc-600 font-normal text-xs ml-1">(인덱싱된 텍스트 확인)</span>
            </h2>
            <ChunkViewer />
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
              <MessageSquare size={15} className="text-blue-500" />
              응답 피드백 통계
            </h2>
            <FeedbackStats />
          </div>
        )}

        {activeTab === "quickquestions" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
              <Zap size={15} className="text-blue-500" />
              빠른 질문 편집
            </h2>
            <QuickQuestionsEditor />
          </div>
        )}
      </div>
    </div>
  );
}
