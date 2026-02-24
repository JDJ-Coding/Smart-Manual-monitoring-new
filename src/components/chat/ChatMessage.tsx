"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { SourceCitation } from "./SourceCitation";
import type { ChatMessage as ChatMessageType } from "@/types";
import { clsx } from "clsx";

interface Props {
  message: ChatMessageType;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function FormattedContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <span key={i}>
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
              ) : (
                part
              )
            )}
            {i < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={clsx("flex animate-fadeIn", isUser ? "justify-end" : "justify-start")}>
      {/* AI indicator dot */}
      {!isUser && (
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-3.5 mr-2.5" />
      )}

      <div className={clsx("max-w-[82%]", isUser ? "" : "")}>
        {/* Message bubble */}
        <div
          className={clsx(
            "relative rounded-2xl px-4 py-3 text-sm leading-relaxed group",
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-zinc-800 border border-zinc-700/60 text-zinc-200 rounded-tl-sm"
          )}
        >
          <FormattedContent content={message.content} />

          {/* Copy button (AI messages only) */}
          {!isUser && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100
                         text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-all"
              title="복사"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
          )}

          {/* Source citations */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <SourceCitation sources={message.sources} />
          )}
        </div>

        {/* Timestamp */}
        <p className={clsx("text-xs text-zinc-600 mt-1 px-1", isUser ? "text-right" : "text-left")}>
          {formatTime(message.timestamp)}
        </p>
      </div>

      {/* User indicator dot */}
      {isUser && (
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-3.5 ml-2.5" />
      )}
    </div>
  );
}
