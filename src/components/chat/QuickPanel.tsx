"use client";

import { useState, useEffect } from "react";
import {
  Zap, Wrench, RefreshCw, AlertTriangle, Thermometer, FileText,
  ChevronRight, ChevronLeft, MessageSquare, BookMarked, Settings,
} from "lucide-react";
import type { QuickQuestion } from "@/types";

const ICON_MAP: Record<string, React.ElementType> = {
  Zap,
  Wrench,
  RefreshCw,
  AlertTriangle,
  Thermometer,
  FileText,
  Settings,
};

const DEFAULT_QUESTIONS: QuickQuestion[] = [
  { id: "1", text: "FR-E800 인버터 알람 E.OC1 원인은?", tag: "알람 코드", icon: "Zap" },
  { id: "2", text: "MR-J4 서보 AL.16 조치 방법", tag: "고장 조치", icon: "Wrench" },
  { id: "3", text: "파라미터 초기화 절차", tag: "설정 초기화", icon: "RefreshCw" },
  { id: "4", text: "과전류 보호 기능 설명", tag: "보호 기능", icon: "AlertTriangle" },
  { id: "5", text: "인버터 과열 알람 해결 방법", tag: "온도 관련", icon: "Thermometer" },
  { id: "6", text: "예방 점검 주기 및 항목", tag: "점검 절차", icon: "FileText" },
];

interface Props {
  onQuickAsk: (question: string) => void;
  messageCount: number;
  sourceCount: number;
  disabled: boolean;
  feedbackScore?: { positive: number; total: number };
  bookmarkCount?: number;
}

export function QuickPanel({ onQuickAsk, messageCount, sourceCount, disabled, feedbackScore, bookmarkCount }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [questions, setQuestions] = useState<QuickQuestion[]>(DEFAULT_QUESTIONS);

  useEffect(() => {
    fetch("/api/quick-questions")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          setQuestions(data.questions);
        }
      })
      .catch(() => {});
  }, []);

  if (collapsed) {
    return (
      <div className="hidden xl:flex w-8 flex-shrink-0 flex-col items-center pt-4 border-l border-zinc-800/60 bg-zinc-950">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="빠른 질문 패널 펼치기"
          aria-label="빠른 질문 패널 펼치기"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <aside className="hidden xl:flex w-56 flex-shrink-0 flex-col border-l border-zinc-800/60 bg-zinc-950"
      aria-label="빠른 질문 패널"
    >
      {/* 헤더 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-900/40">
        <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">빠른 질문</span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-0.5 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="패널 접기"
          aria-label="빠른 질문 패널 접기"
        >
          <ChevronLeft size={13} />
        </button>
      </div>

      {/* 현재 세션 통계 */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800/40">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2.5">현재 세션</p>
        <div className="flex gap-4 flex-wrap">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <MessageSquare size={10} className="text-zinc-500" />
              <p className="text-sm font-semibold text-zinc-200 tabular-nums">{messageCount}</p>
            </div>
            <p className="text-[10px] text-zinc-500">메시지</p>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <BookMarked size={10} className="text-zinc-500" />
              <p className="text-sm font-semibold text-zinc-200 tabular-nums">{sourceCount}</p>
            </div>
            <p className="text-[10px] text-zinc-500">참조 소스</p>
          </div>
          {feedbackScore !== undefined && feedbackScore.total > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-sm font-semibold text-zinc-200 tabular-nums">
                {feedbackScore.positive}/{feedbackScore.total}
              </p>
              <p className="text-[10px] text-zinc-500">만족도</p>
            </div>
          )}
          {bookmarkCount !== undefined && bookmarkCount > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-sm font-semibold text-zinc-200 tabular-nums">{bookmarkCount}</p>
              <p className="text-[10px] text-zinc-500">북마크</p>
            </div>
          )}
        </div>
      </div>

      {/* 빠른 질문 버튼 목록 */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-1">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider px-2 mb-2">예시 질문</p>
        {questions.map((q) => {
          const Icon = ICON_MAP[q.icon] ?? FileText;
          return (
            <button
              key={q.id}
              onClick={() => !disabled && onQuickAsk(q.text)}
              disabled={disabled}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-zinc-800/60
                         bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-700
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all group animate-fadeIn"
              aria-label={`빠른 질문: ${q.text}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={11} className="text-blue-500 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
                <span className="text-[10px] text-zinc-500 font-medium">{q.tag}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-snug group-hover:text-zinc-200 transition-colors line-clamp-2">
                {q.text}
              </p>
            </button>
          );
        })}
      </div>

      {/* 하단 안내 */}
      {disabled && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-zinc-800/40">
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            DB를 구축하면 빠른 질문을 사용할 수 있습니다.
          </p>
        </div>
      )}
    </aside>
  );
}
