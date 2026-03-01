"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { WelcomeScreen } from "./WelcomeScreen";
import { ChevronDown, Calendar, Clock } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types";

interface Props {
  dbBuilt: boolean;
  selectedManual: string;
  initialMessages?: ChatMessageType[];
  onSessionUpdate: (messages: ChatMessageType[]) => void;
  pendingQuestion?: string | null;
  onPendingQuestionConsumed?: () => void;
}

function formatDateTime(date: Date): { date: string; time: string } {
  const dateStr = date.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const timeStr = date.toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return { date: dateStr, time: timeStr };
}

export function ChatContainer({
  dbBuilt,
  selectedManual,
  initialMessages = [],
  onSessionUpdate,
  pendingQuestion,
  onPendingQuestionConsumed,
}: Props) {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 날짜/시간 시계 (1분마다 갱신)
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (isLoading || messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isLoading, scrollToBottom]);

  // 우측 QuickPanel에서 전달된 질문 자동 전송
  useEffect(() => {
    if (pendingQuestion && !isLoading) {
      handleSend(pendingQuestion);
      onPendingQuestionConsumed?.();
    }
  // handleSend는 아래에서 정의되므로 의존성에서 제외 (stale closure 안전)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 200);
  }, []);

  const handleSend = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMsg: ChatMessageType = {
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };

    const withUser = [...messages, userMsg];
    setMessages(withUser);
    onSessionUpdate(withUser);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          filterFilename:
            selectedManual !== "전체 매뉴얼 검색" ? selectedManual : undefined,
        }),
      });

      const data = await response.json();

      const assistantMsg: ChatMessageType = {
        role: "assistant",
        content: response.ok
          ? (data.answer || "응답을 받지 못했습니다.")
          : (data.error || "서버 오류가 발생했습니다. 다시 시도해주세요."),
        sources: response.ok ? (data.sources || []) : [],
        timestamp: new Date().toISOString(),
      };

      const final = [...withUser, assistantMsg];
      setMessages(final);
      onSessionUpdate(final);
    } catch {
      const errorMsg: ChatMessageType = {
        role: "assistant",
        content: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
        timestamp: new Date().toISOString(),
      };
      const final = [...withUser, errorMsg];
      setMessages(final);
      onSessionUpdate(final);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-zinc-950">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-zinc-800/60 px-6 py-2.5 flex items-center gap-3 bg-zinc-900/40">
        <span className="text-xs text-zinc-500">검색 대상</span>
        <span className="text-xs font-medium text-zinc-300 bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-700">
          {selectedManual}
        </span>
        {!dbBuilt && (
          <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full">
            ⚠ DB 미구축
          </span>
        )}

        {/* 날짜/시간 (우측 정렬) */}
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          {now && (
            <>
              <Calendar size={11} className="text-zinc-600 flex-shrink-0" />
              <span>{formatDateTime(now).date}</span>
              <Clock size={11} className="text-zinc-600 flex-shrink-0 ml-1" />
              <span className="font-mono tabular-nums text-zinc-400 font-medium">
                {formatDateTime(now).time}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Messages scroll area */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative"
      >
        <div className="max-w-3xl mx-auto px-5 py-6">
          {messages.length === 0 ? (
            <WelcomeScreen onExampleClick={handleSend} dbBuilt={dbBuilt} />
          ) : (
            <div className="space-y-3" role="list" aria-label="대화 메시지">
              {messages.map((msg) => (
                <ChatMessage
                  key={`${msg.role}-${msg.timestamp}`}
                  message={msg}
                />
              ))}
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div
              className="flex items-start gap-2.5 mt-3 animate-fadeIn"
              aria-live="polite"
              aria-label="응답 생성 중"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-3.5" />
              <div className="bg-zinc-800 border border-zinc-700/60 rounded-2xl rounded-tl-sm px-4 py-3 inline-flex items-center gap-1.5">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400 block" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400 block" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400 block" />
                <span className="text-xs text-zinc-500 ml-2">매뉴얼 검색 중…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Scroll-to-bottom button */}
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom("smooth")}
            className="fixed bottom-28 right-8 z-10 w-8 h-8 rounded-full
                       bg-zinc-800 border border-zinc-700 shadow-lg
                       flex items-center justify-center
                       text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700
                       transition-all animate-fadeIn"
            aria-label="맨 아래로 스크롤"
            title="맨 아래로"
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-zinc-800/60 bg-zinc-950 px-5 py-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSend} disabled={isLoading || !dbBuilt} />
          {!dbBuilt && (
            <p className="text-xs text-zinc-600 mt-2 text-center">
              <a href="/admin/login" className="text-amber-500 hover:text-amber-400 transition-colors underline">
                관리자 패널
              </a>
              에서 PDF를 업로드하고 DB를 구축하세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
