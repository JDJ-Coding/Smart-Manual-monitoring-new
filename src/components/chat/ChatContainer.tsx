"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { WelcomeScreen } from "./WelcomeScreen";
import type { ChatMessage as ChatMessageType } from "@/types";

interface Props {
  manualFiles: string[];
  dbBuilt: boolean;
  selectedManual: string;
}

export function ChatContainer({ manualFiles: _manualFiles, dbBuilt, selectedManual }: Props) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMsg: ChatMessageType = {
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
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

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full px-4">
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.length === 0 ? (
          <WelcomeScreen onExampleClick={handleSend} dbBuilt={dbBuilt} />
        ) : (
          messages.map((msg, idx) => <ChatMessage key={idx} message={msg} />)
        )}

        {isLoading && (
          <div className="flex justify-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#023E8A] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 bg-[#00B4D8] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="inline-block w-2 h-2 bg-[#00B4D8] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="inline-block w-2 h-2 bg-[#00B4D8] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="text-xs text-gray-400 ml-1">매뉴얼 검색 중...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="py-4 border-t border-gray-100">
        <ChatInput onSend={handleSend} disabled={isLoading || !dbBuilt} />
        {!dbBuilt && (
          <p className="text-xs text-amber-600 mt-2 text-center">
            DB가 구축되지 않았습니다.{" "}
            <a href="/admin/login" className="underline hover:text-amber-800">
              관리자 패널
            </a>
            에서 DB를 재구축하세요.
          </p>
        )}
      </div>
    </div>
  );
}
