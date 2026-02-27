"use client";

import { useState } from "react";
import { Wrench, Settings, Database, ChevronLeft, ChevronRight, Plus, Trash2, BookOpen, MessageSquare, Menu, X } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import type { ChatSession } from "@/types";

interface Props {
  manualFiles: string[];
  dbBuilt: boolean;
  selectedManual: string;
  onManualChange: (manual: string) => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSessionSelect: (id: string) => void;
  onSessionDelete: (id: string) => void;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return new Date(isoString).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function Sidebar({
  manualFiles,
  dbBuilt,
  selectedManual,
  onManualChange,
  sessions,
  currentSessionId,
  onNewChat,
  onSessionSelect,
  onSessionDelete,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const manualOptions = ["전체 매뉴얼 검색", ...manualFiles];

  const handleSessionSelectAndClose = (id: string) => {
    onSessionSelect(id);
    setMobileOpen(false);
  };

  const handleNewChatAndClose = () => {
    onNewChat();
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 w-8 h-8 flex items-center justify-center
                   bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
        aria-label="사이드바 열기"
      >
        <Menu size={16} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/60"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

    <aside
      className={clsx(
        "h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0 transition-all duration-300",
        // Desktop: collapsible
        "hidden md:flex",
        collapsed ? "w-14" : "w-64",
        // Mobile: drawer overlay
        mobileOpen && "!flex fixed inset-y-0 left-0 z-30 w-72 shadow-2xl"
      )}
      aria-label="내비게이션 사이드바"
    >
      {/* Header */}
      <div className={clsx(
        "flex items-center border-b border-zinc-800 flex-shrink-0",
        collapsed ? "justify-center py-4 px-2" : "px-4 py-4 gap-3"
      )}>
        {!collapsed && (
          <>
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Wrench size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-zinc-100 text-sm leading-tight truncate">Smart Manual</div>
              <div className="text-xs text-zinc-500 leading-tight">AI 매뉴얼 어시스턴트</div>
            </div>
          </>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Wrench size={14} className="text-white" />
          </div>
        )}
        {/* Mobile close button */}
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded md:hidden"
            aria-label="사이드바 닫기"
          >
            <X size={15} />
          </button>
        )}
        {/* Desktop collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx(
            "text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 p-0.5 rounded hidden md:block",
            collapsed && "mt-0"
          )}
          title={collapsed ? "펼치기" : "접기"}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* New Chat button */}
      <div className={clsx("flex-shrink-0 p-2", collapsed && "flex justify-center")}>
        <button
          onClick={handleNewChatAndClose}
          className={clsx(
            "flex items-center gap-2 rounded-lg text-sm font-medium transition-colors",
            "bg-blue-600 hover:bg-blue-500 text-white",
            collapsed
              ? "w-10 h-10 justify-center"
              : "w-full px-3 py-2"
          )}
          title="새 대화"
        >
          <Plus size={15} />
          {!collapsed && <span>새 대화</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Chat History */}
          <div className="flex-1 overflow-y-auto py-1">
            {sessions.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <MessageSquare size={24} className="text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-600">대화 기록이 없습니다.</p>
                <p className="text-xs text-zinc-700 mt-0.5">새 대화를 시작하세요</p>
              </div>
            ) : (
              <>
                <p className="px-3 py-1.5 text-xs font-medium text-zinc-600 uppercase tracking-wider">
                  최근 대화
                </p>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={clsx(
                      "group relative mx-2 mb-0.5 rounded-lg cursor-pointer transition-colors",
                      session.id === currentSessionId
                        ? "bg-zinc-700/60 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    )}
                  >
                    <button
                      onClick={() => handleSessionSelectAndClose(session.id)}
                      className="w-full text-left px-3 py-2 pr-8"
                    >
                      <p className="text-sm leading-snug truncate font-medium">
                        {session.title}
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {formatRelativeTime(session.updatedAt)}
                      </p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSessionDelete(session.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded
                                 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="대화 삭제"
                      aria-label={`"${session.title}" 대화 삭제`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Divider */}
          <div className="flex-shrink-0 border-t border-zinc-800 mt-auto" />

          {/* Manual Selector */}
          <div className="flex-shrink-0 px-3 py-3 space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <BookOpen size={10} />
              검색 대상
            </label>
            <select
              value={selectedManual}
              onChange={(e) => onManualChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300
                         px-2.5 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              {manualOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-600">{manualFiles.length}개 매뉴얼</p>
          </div>

          {/* DB Status + Admin */}
          <div className="flex-shrink-0 border-t border-zinc-800 px-3 py-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Database size={11} className="text-zinc-600" />
              <span className="text-zinc-500">DB</span>
              <span className={clsx("font-medium ml-auto", dbBuilt ? "text-emerald-400" : "text-red-400")}>
                {dbBuilt ? "● 정상" : "● 미구축"}
              </span>
            </div>
            <Link
              href="/admin/login"
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Settings size={12} />
              관리자 패널
            </Link>
          </div>
        </div>
      )}

      {/* Collapsed: DB status + admin */}
      {collapsed && (
        <div className="flex-1 flex flex-col items-center gap-2 pt-2 pb-4">
          <div className="flex-1" />
          <div
            className={clsx(
              "w-2 h-2 rounded-full",
              dbBuilt ? "bg-emerald-400" : "bg-red-400"
            )}
            title={dbBuilt ? "DB 정상" : "DB 미구축"}
            aria-label={dbBuilt ? "DB 정상" : "DB 미구축"}
          />
          <Link
            href="/admin/login"
            className="text-zinc-600 hover:text-zinc-300 transition-colors p-1"
            title="관리자 패널"
            aria-label="관리자 패널"
          >
            <Settings size={15} />
          </Link>
        </div>
      )}
    </aside>
    </>
  );
}
