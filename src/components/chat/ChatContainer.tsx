"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage, StreamingCursor } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { WelcomeScreen } from "./WelcomeScreen";
import { ChevronDown, Calendar, Clock } from "lucide-react";
import type { ChatMessage as ChatMessageType, SourceReference } from "@/types";

interface Props {
  dbBuilt: boolean;
  selectedManual: string;
  initialMessages?: ChatMessageType[];
  onSessionUpdate: (messages: ChatMessageType[]) => void;
  pendingQuestion?: string | null;
  onPendingQuestionConsumed?: () => void;
  sessionId?: string | null;
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
  sessionId,
}: Props) {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"searching" | "generating" | "tool">("searching");
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 날짜/시간 시계 (1분마다 갱신)
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // 일일방문자수 집계 (하루 1회)
  useEffect(() => {
    const date = new Date().toISOString().slice(0, 10);
    const key = `visitor_counted_${date}`;
    const alreadyCounted = localStorage.getItem(key);
    const method = alreadyCounted ? "GET" : "POST";
    fetch("/api/visitors", { method })
      .then((r) => r.json())
      .then((d) => setVisitorCount(d.count))
      .catch(() => {});
    if (!alreadyCounted) localStorage.setItem(key, "1");
  }, []);

  // 컴포넌트 언마운트 시 진행 중인 스트림 취소
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  // 네트워크 상태 감지
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (isLoading || messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isLoading, streamingContent, scrollToBottom]);

  // QuickPanel에서 전달된 질문 자동 전송
  useEffect(() => {
    if (pendingQuestion && !isLoading) {
      handleSend(pendingQuestion);
      onPendingQuestionConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 200);
  }, []);

  const handleFeedback = useCallback(async (
    index: number,
    rating: "positive" | "negative",
    reason?: string
  ) => {
    setMessages((prev) => {
      const updated = prev.map((m, i) =>
        i === index ? { ...m, feedbackGiven: rating } : m
      );
      onSessionUpdate(updated);
      return updated;
    });

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId ?? "unknown",
          messageIndex: index,
          rating,
          reason,
        }),
      });
    } catch {
      // ignore feedback errors
    }
  }, [sessionId, onSessionUpdate]);

  const handleBookmark = useCallback((index: number) => {
    setMessages((prev) => {
      const updated = prev.map((m, i) =>
        i === index ? { ...m, bookmarked: !m.bookmarked } : m
      );
      onSessionUpdate(updated);
      return updated;
    });
  }, [onSessionUpdate]);

  const handleSend = async (question: string) => {
    if (!question.trim() || isLoading) return;

    // 이전 요청 취소 후 새 컨트롤러 생성
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg: ChatMessageType = {
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };

    const originalMessages = [...messages];
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    onSessionUpdate(withUser);
    setIsLoading(true);
    setLoadingStage("searching");
    setActiveToolName(null);
    setStreamingContent("");

    // 첫 SSE 청크 15초 타임아웃
    let firstChunkReceived = false;
    const timeoutId = setTimeout(() => {
      if (!firstChunkReceived) {
        controller.abort();
      }
    }, 15000);

    try {
      const recentHistory = withUser.slice(-7, -1).map(({ role, content }) => ({
        role,
        content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          filterFilename:
            selectedManual !== "전체 매뉴얼 검색" ? selectedManual : undefined,
          conversationHistory: recentHistory,
          sessionId: sessionId ?? "anonymous",
        }),
        signal: controller.signal,
      });

      // ── SSE streaming ──────────────────────────────────────────────────────
      if (response.headers.get("Content-Type")?.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let sources: SourceReference[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 첫 청크 도착 시 타임아웃 취소
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            clearTimeout(timeoutId);
          }

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const evt = JSON.parse(data);
              if (evt.type === "tool_start") {
                const toolLabels: Record<string, string> = {
                  calculator: "계산기",
                  unit_converter: "단위 변환",
                  alarm_lookup: "알람 조회",
                };
                setLoadingStage("tool");
                setActiveToolName(toolLabels[evt.toolName] ?? evt.toolName);
              } else if (evt.type === "tool_end") {
                setActiveToolName(null);
              } else if (evt.type === "delta" && evt.content) {
                if (accumulated === "") setLoadingStage("generating");
                accumulated += evt.content;
                setStreamingContent(accumulated);
              } else if (evt.type === "done") {
                sources = evt.sources ?? [];
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        const assistantMsg: ChatMessageType = {
          role: "assistant",
          content: accumulated || "응답을 받지 못했습니다.",
          sources,
          timestamp: new Date().toISOString(),
        };
        const final = [...withUser, assistantMsg];
        setMessages(final);
        onSessionUpdate(final);
      } else {
        // ── Fallback: JSON response ──────────────────────────────────────────
        clearTimeout(timeoutId);
        const data = await response.json();
        const assistantMsg: ChatMessageType = {
          role: "assistant",
          content: response.ok
            ? (data.answer || "응답을 받지 못했습니다.")
            : (data.error || "서버 오류가 발생했습니다."),
          sources: response.ok ? (data.sources ?? []) : [],
          timestamp: new Date().toISOString(),
        };
        const final = [...withUser, assistantMsg];
        setMessages(final);
        onSessionUpdate(final);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      // AbortError는 의도적 취소이므로 userMsg를 제거하여 원래 상태로 복원
      if (err instanceof Error && err.name === "AbortError") {
        // 타임아웃에 의한 취소인 경우 메시지 표시
        if (!firstChunkReceived) {
          const timeoutMsg: ChatMessageType = {
            role: "assistant",
            content: "응답 시간이 초과되었습니다. 다시 시도해주세요.",
            timestamp: new Date().toISOString(),
          };
          const final = [...withUser, timeoutMsg];
          setMessages(final);
          onSessionUpdate(final);
        } else {
          setMessages(originalMessages);
        }
        return;
      }
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
      setStreamingContent("");
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-zinc-950">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-zinc-800/60 px-3 py-2 md:px-6 md:py-2.5 flex items-center gap-3 bg-zinc-900/40">
        <span className="text-xs text-zinc-400">검색 대상</span>
        <span className="text-xs font-medium text-zinc-300 bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-700">
          {selectedManual}
        </span>
        {!dbBuilt && (
          <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full">
            ⚠ DB 미구축
          </span>
        )}
        {!isOnline && (
          <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full">
            ⚡ 네트워크 연결 없음
          </span>
        )}

        {/* 브랜드 */}
        <span className="ml-auto text-sm font-extrabold text-blue-500 tracking-tight">
          Posco Futurem
        </span>

        {/* 일일방문자수 */}
        {visitorCount !== null && (
          <span className="text-xs text-zinc-400 border-l border-zinc-700 pl-3">
            일일방문자수 :{" "}
            <span className="text-zinc-200 font-semibold">{visitorCount}</span>명
          </span>
        )}

        {/* 날짜/시간 */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          {now && (
            <>
              <Calendar size={11} className="text-zinc-400 flex-shrink-0" />
              <span>{formatDateTime(now).date}</span>
              <Clock size={11} className="text-zinc-400 flex-shrink-0 ml-1" />
              <span className="font-mono tabular-nums text-zinc-300 font-medium">
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
        <div className="max-w-3xl mx-auto px-3 md:px-5 py-6">
          {messages.length === 0 && !isLoading ? (
            <WelcomeScreen onExampleClick={handleSend} dbBuilt={dbBuilt} />
          ) : (
            <div className="space-y-3" role="list" aria-label="대화 메시지">
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={`${msg.role}-${msg.timestamp}-${idx}`}
                  message={msg}
                  messageIndex={idx}
                  sessionId={sessionId ?? undefined}
                  onFeedback={msg.role === "assistant" ? handleFeedback : undefined}
                  onBookmark={msg.role === "assistant" ? handleBookmark : undefined}
                />
              ))}
            </div>
          )}

          {/* Streaming bubble */}
          {isLoading && streamingContent && (
            <div className="flex items-start gap-2.5 mt-3 animate-fadeIn">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-3.5" />
              <div className="bg-zinc-800 border border-zinc-700/60 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[82%] text-base text-zinc-200 leading-relaxed">
                {streamingContent}
                <StreamingCursor />
              </div>
            </div>
          )}

          {/* Loading dots (before first chunk arrives) */}
          {isLoading && !streamingContent && (
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
                <span className="text-xs text-zinc-400 ml-2">
                  {loadingStage === "searching"
                    ? "매뉴얼 검색 중…"
                    : loadingStage === "tool"
                    ? `${activeToolName ?? "도구"} 실행 중…`
                    : "답변 생성 중…"}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Scroll-to-bottom button */}
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom("smooth")}
            className="fixed bottom-24 right-4 md:bottom-28 md:right-8 z-10 w-8 h-8 rounded-full
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
      <div className="flex-shrink-0 border-t border-zinc-800/60 bg-zinc-950 px-3 py-3 md:px-5 md:py-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSend} disabled={isLoading || !dbBuilt} />
          <p className="text-sm text-white mt-1.5 text-center">
            {!dbBuilt ? (
              <>
                <a href="/admin/login" className="text-amber-500 hover:text-amber-400 transition-colors underline">
                  관리자 패널
                </a>
                에서 PDF를 업로드하고 DB를 구축하세요.
              </>
            ) : (
              "※ 개인정보, 국가핵심기술 등 주요정보 입력은 금지합니다."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
