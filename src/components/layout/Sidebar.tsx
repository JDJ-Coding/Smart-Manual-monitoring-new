"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Wrench, Settings, Database, ChevronLeft, ChevronRight,
  Plus, Trash2, BookOpen, MessageSquare, Menu, X,
  Search, Download, MoreHorizontal, Pencil, Check,
} from "lucide-react";
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
  onSessionRename?: (id: string, title: string) => void;
}

interface SearchedSession extends ChatSession {
  matchedExcerpt?: string;
  matchCount?: number;
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

function exportSessionAsMarkdown(session: ChatSession): void {
  const lines: string[] = [
    `# ${session.title}`,
    `> 생성: ${new Date(session.createdAt).toLocaleString("ko-KR")}  `,
    `> 검색 대상: ${session.selectedManual}`,
    "",
  ];

  for (const msg of session.messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString("ko-KR", {
      hour: "2-digit", minute: "2-digit",
    });
    const role = msg.role === "user" ? "**사용자**" : "**AI 어시스턴트**";
    lines.push("---");
    lines.push(`${role} *(${time})*`);
    lines.push("");
    lines.push(msg.content);
    if (msg.sources && msg.sources.length > 0) {
      lines.push("");
      lines.push(`*참조: ${msg.sources.map((s) => `${s.filename} p.${s.page}`).join(", ")}*`);
    }
    lines.push("");
  }

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.title.slice(0, 30)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportSessionAsJSON(session: ChatSession): void {
  const totalMessages = session.messages.length;
  const userMessages = session.messages.filter((m) => m.role === "user").length;
  const assistantMessages = session.messages.filter((m) => m.role === "assistant").length;
  const totalSources = session.messages.reduce((acc, m) => acc + (m.sources?.length ?? 0), 0);
  const bookmarkedMessages = session.messages.filter((m) => m.bookmarked).length;

  const exportData = {
    exportedAt: new Date().toISOString(),
    session,
    statistics: {
      totalMessages,
      userMessages,
      assistantMessages,
      totalSources,
      bookmarkedMessages,
    },
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.title.slice(0, 30)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-blue-400 font-medium">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
  searchQuery,
}: {
  session: SearchedSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  searchQuery?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const startEdit = useCallback(() => {
    setEditTitle(session.title);
    setEditing(true);
    setShowMenu(false);
    setTimeout(() => inputRef.current?.select(), 50);
  }, [session.title]);

  const commitEdit = useCallback(() => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed);
    }
    setEditing(false);
  }, [editTitle, session.title, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitEdit();
      if (e.key === "Escape") setEditing(false);
    },
    [commitEdit]
  );

  return (
    <div
      className={clsx(
        "group relative mx-2 mb-0.5 rounded-lg transition-colors",
        showMenu && "z-50",
        isActive
          ? "bg-zinc-700/60 text-zinc-100"
          : "text-zinc-200 hover:bg-zinc-800 hover:text-zinc-100"
      )}
    >
      {editing ? (
        <div className="flex items-center gap-1 px-2 py-1.5">
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            className="flex-1 bg-zinc-800 border border-blue-500/50 rounded px-2 py-1 text-xs text-zinc-100 outline-none"
            autoFocus
          />
          <button onClick={commitEdit} className="text-emerald-400 p-0.5" aria-label="저장">
            <Check size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={onSelect}
          onDoubleClick={startEdit}
          className="w-full text-left px-3 py-2 pr-8"
          title="더블클릭하여 제목 변경"
        >
          <p className="text-sm leading-snug truncate font-medium text-zinc-200">
            {searchQuery ? highlightText(session.title, searchQuery) : session.title}
          </p>
          {session.matchedExcerpt && searchQuery && (
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              …{highlightText(session.matchedExcerpt, searchQuery)}…
            </p>
          )}
          <p className="text-xs text-zinc-500 mt-0.5">{formatRelativeTime(session.updatedAt)}</p>
        </button>
      )}

      {/* Context menu */}
      {!editing && (
        <div className={clsx(
          "absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-all",
          showMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/80"
              aria-label="더보기"
            >
              <MoreHorizontal size={12} />
            </button>

            {showMenu && (
              <div
                ref={menuRef}
                className="absolute right-0 top-6 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px] animate-fadeIn"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                >
                  <Pencil size={11} />
                  제목 변경
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportSessionAsMarkdown(session);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                >
                  <Download size={11} />
                  마크다운으로 내보내기
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportSessionAsJSON(session);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                >
                  <Download size={11} />
                  JSON으로 내보내기
                </button>
                <hr className="border-zinc-700 my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700 flex items-center gap-2"
                  aria-label={`${session.title} 삭제`}
                >
                  <Trash2 size={11} />
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
  onSessionRename,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const manualOptions = ["전체 매뉴얼 검색", ...manualFiles];

  const filteredSessions: SearchedSession[] = searchQuery.trim()
    ? sessions
        .filter(
          (s) =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.messages.some((m) =>
              m.content.toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
        .map((s) => {
          const matchedMsg = s.messages.find((m) =>
            m.content.toLowerCase().includes(searchQuery.toLowerCase())
          );
          if (matchedMsg && !s.title.toLowerCase().includes(searchQuery.toLowerCase())) {
            const idx = matchedMsg.content.toLowerCase().indexOf(searchQuery.toLowerCase());
            const start = Math.max(0, idx - 15);
            const excerpt = matchedMsg.content.slice(start, start + 60);
            return { ...s, matchedExcerpt: excerpt, matchCount: 1 };
          }
          return { ...s };
        })
    : sessions;

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
      {/* Mobile toggle */}
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
          "hidden md:flex",
          collapsed ? "w-14" : "w-64",
          mobileOpen && "!flex fixed inset-y-0 left-0 z-30 w-72 shadow-2xl"
        )}
        aria-label="내비게이션 사이드바"
      >
        {/* Header */}
        <div
          className={clsx(
            "flex items-center border-b border-zinc-800 flex-shrink-0",
            collapsed ? "justify-center py-4 px-2" : "px-4 py-4 gap-3"
          )}
        >
          {!collapsed && (
            <>
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Wrench size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-zinc-100 text-sm leading-tight truncate">Smart Manual</div>
                <div className="text-xs text-zinc-400 leading-tight">AI 매뉴얼 어시스턴트</div>
              </div>
            </>
          )}
          {collapsed && (
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Wrench size={14} className="text-white" />
            </div>
          )}
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="text-zinc-400 hover:text-zinc-200 transition-colors p-0.5 rounded md:hidden"
              aria-label="사이드바 닫기"
            >
              <X size={15} />
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors flex-shrink-0 p-0.5 rounded hidden md:block"
            title={collapsed ? "펼치기" : "접기"}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* 검색 대상 */}
        {!collapsed && (
          <div className="flex-shrink-0 px-3 py-2.5 border-b border-zinc-800">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
              <BookOpen size={10} />
              검색 대상
            </label>
            <select
              value={selectedManual}
              onChange={(e) => onManualChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200
                         px-2.5 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              {manualOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-1">{manualFiles.length}개 매뉴얼</p>
          </div>
        )}

        {/* 새 대화 */}
        <div className={clsx("flex-shrink-0 p-2", collapsed && "flex justify-center")}>
          <button
            onClick={handleNewChatAndClose}
            className={clsx(
              "flex items-center gap-2 rounded-lg text-sm font-medium transition-colors",
              "bg-blue-600 hover:bg-blue-500 text-white",
              collapsed ? "w-10 h-10 justify-center" : "w-full px-3 py-2"
            )}
            title="새 대화"
          >
            <Plus size={15} />
            {!collapsed && <span>새 대화</span>}
          </button>
        </div>

        {!collapsed && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* 세션 검색 */}
            <div className="flex-shrink-0 px-2 pb-1">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="대화 검색…"
                  className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-lg text-xs text-zinc-200
                             pl-7 pr-2.5 py-1.5 focus:outline-none focus:border-zinc-600 placeholder:text-zinc-600 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    aria-label="검색 지우기"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>

            {/* 대화 기록 */}
            <div className="flex-1 overflow-y-auto py-1">
              {filteredSessions.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <MessageSquare size={24} className="text-zinc-500 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">
                    {searchQuery ? "검색 결과 없음" : "대화 기록이 없습니다."}
                  </p>
                  {!searchQuery && (
                    <p className="text-xs text-zinc-500 mt-0.5">새 대화를 시작하세요</p>
                  )}
                </div>
              ) : (
                <>
                  <p className="px-3 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    {searchQuery ? `검색 결과 (${filteredSessions.length})` : "최근 대화"}
                  </p>
                  {filteredSessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isActive={session.id === currentSessionId}
                      onSelect={() => handleSessionSelectAndClose(session.id)}
                      onDelete={() => onSessionDelete(session.id)}
                      onRename={(title) => onSessionRename?.(session.id, title)}
                      searchQuery={searchQuery || undefined}
                    />
                  ))}
                </>
              )}
            </div>

            {/* DB Status + Admin + 문의 */}
            <div className="flex-shrink-0 border-t border-zinc-800 px-3 py-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Database size={11} className="text-zinc-400" />
                <span className="text-zinc-400">DB</span>
                <span
                  className={clsx(
                    "font-medium ml-auto",
                    dbBuilt ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {dbBuilt ? "● 정상" : "● 미구축"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <Link
                  href="/admin"
                  className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <Settings size={12} />
                  관리자 패널
                </Link>
              </div>
              <p className="text-sm text-zinc-200 pt-0.5 border-t border-zinc-800">
                문의 : 설비기획그룹 장덕진 대리
              </p>
            </div>
          </div>
        )}

        {/* Collapsed */}
        {collapsed && (
          <div className="flex-1 flex flex-col items-center gap-2 pt-2 pb-4">
            <div className="flex-1" />
            <div
              className={clsx("w-2 h-2 rounded-full", dbBuilt ? "bg-emerald-400" : "bg-red-400")}
              title={dbBuilt ? "DB 정상" : "DB 미구축"}
            />
            <Link
              href="/admin"
              className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
              title="관리자 패널"
            >
              <Settings size={15} />
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
