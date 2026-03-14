"use client";

import { useState } from "react";
import { Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { SourceCitation } from "./SourceCitation";
import type { ChatMessage as ChatMessageType } from "@/types";
import { clsx } from "clsx";

interface Props {
  message: ChatMessageType;
  messageIndex?: number;
  sessionId?: string;
  onFeedback?: (index: number, rating: "positive" | "negative", reason?: string) => void;
}

const FEEDBACK_REASONS = ["답변 부정확", "출처 없음", "질문 오해", "기타"];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ─── Markdown renderer (react-markdown + remark-gfm + rehype-highlight) ────────
function FormattedContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        h1: ({ children }) => (
          <p className="text-lg font-bold text-zinc-100 mt-3 mb-1">{children}</p>
        ),
        h2: ({ children }) => (
          <p className="text-base font-bold text-zinc-200 mt-2.5 mb-1">{children}</p>
        ),
        h3: ({ children }) => (
          <p className="text-base font-semibold text-zinc-300 mt-2 mb-0.5">{children}</p>
        ),
        p: ({ children }) => (
          <p className="text-base leading-relaxed text-zinc-200">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="my-1.5 space-y-1 pl-4 list-disc text-zinc-200">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-1.5 space-y-1 pl-4 list-decimal text-zinc-200">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-base leading-relaxed">{children}</li>
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code: ({ inline, className, children, ...props }: any) =>
          inline ? (
            <code
              className="font-mono text-xs bg-zinc-900/80 border border-zinc-700/40 rounded px-1.5 py-0.5 text-blue-300"
              {...props}
            >
              {children}
            </code>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          ),
        pre: ({ children }) => (
          <pre className="my-2 rounded-lg bg-zinc-900 border border-zinc-700/60 px-4 py-3 overflow-x-auto text-xs font-mono text-zinc-300 leading-relaxed">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 pl-3 border-l-2 border-blue-500/50 text-zinc-400 italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-2 border-zinc-700/60" />,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-zinc-700/60">
            <table className="w-full text-xs">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="even:bg-zinc-800/20 odd:bg-zinc-900/40">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold text-zinc-300 border-b border-zinc-700/60 bg-zinc-800/80 whitespace-nowrap">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-zinc-300 border-b border-zinc-800/40">{children}</td>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-zinc-100">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-zinc-300">{children}</em>
        ),
        del: ({ children }) => (
          <del className="line-through text-zinc-500">{children}</del>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Streaming cursor ─────────────────────────────────────────────────────────
export function StreamingCursor() {
  return <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle" />;
}

// ─── ChatMessage component ────────────────────────────────────────────────────
export function ChatMessage({ message, messageIndex, sessionId, onFeedback }: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(message.content);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = message.content;
        textArea.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handlePositive = () => {
    if (messageIndex !== undefined && onFeedback) {
      onFeedback(messageIndex, "positive");
    }
  };

  const handleNegative = (reason?: string) => {
    if (messageIndex !== undefined && onFeedback) {
      onFeedback(messageIndex, "negative", reason);
    }
    setShowReasonPicker(false);
  };

  // suppress unused warning — sessionId may be used by parent context
  void sessionId;

  return (
    <div
      className={clsx("flex animate-fadeIn", isUser ? "justify-end" : "justify-start")}
      role="listitem"
    >
      {/* AI indicator dot */}
      {!isUser && (
        <div
          className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-3.5 mr-2.5"
          aria-hidden="true"
        />
      )}

      <div className="max-w-[90%] md:max-w-[82%]">
        {/* Message bubble */}
        <div
          className={clsx(
            "relative rounded-2xl px-4 py-3 text-base leading-relaxed group",
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-zinc-800 border border-zinc-700/60 text-zinc-200 rounded-tl-sm"
          )}
        >
          {isUser ? (
            <p className="text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <FormattedContent content={message.content} />
          )}

          {/* Copy button (AI messages only) */}
          {!isUser && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-2.5 md:p-1.5 rounded-md
                         text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/80
                         transition-all"
              title={copied ? "복사됨" : "복사"}
              aria-label={copied ? "복사됨" : "응답 복사"}
            >
              {copied ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}

          {/* Source citations */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <SourceCitation sources={message.sources} />
          )}
        </div>

        {/* Feedback buttons (AI messages only) */}
        {!isUser && onFeedback && messageIndex !== undefined && (
          <div className="flex items-center gap-1.5 mt-1 px-1">
            {message.feedbackGiven ? (
              <span className="text-xs text-zinc-600">
                {message.feedbackGiven === "positive" ? "👍 도움이 됐습니다" : "👎 피드백 감사합니다"}
              </span>
            ) : (
              <>
                <span className="text-[10px] text-zinc-700 mr-0.5">도움이 됐나요?</span>
                <button
                  onClick={handlePositive}
                  className="p-2 md:p-1 rounded text-zinc-600 hover:text-emerald-400 hover:bg-zinc-800 transition-all"
                  title="도움이 됐어요"
                  aria-label="좋은 답변"
                >
                  <ThumbsUp size={12} />
                </button>
                <button
                  onClick={() => setShowReasonPicker(!showReasonPicker)}
                  className="p-2 md:p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-all"
                  title="도움이 안 됐어요"
                  aria-label="나쁜 답변"
                >
                  <ThumbsDown size={12} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Negative reason picker */}
        {showReasonPicker && (
          <div className="mt-1 px-1 flex flex-wrap gap-1.5 animate-fadeIn">
            {FEEDBACK_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => handleNegative(reason)}
                className="text-[10px] px-2 py-1 rounded-full border border-zinc-700 bg-zinc-900
                           text-zinc-400 hover:border-red-500/50 hover:text-red-400 transition-all"
              >
                {reason}
              </button>
            ))}
            <button
              onClick={() => setShowReasonPicker(false)}
              className="text-[10px] px-2 py-1 rounded-full border border-zinc-800 text-zinc-600 hover:text-zinc-400 transition-all"
            >
              취소
            </button>
          </div>
        )}

        {/* Timestamp */}
        <p
          className={clsx(
            "text-xs text-zinc-600 mt-1 px-1",
            isUser ? "text-right" : "text-left"
          )}
          aria-label={`전송 시각: ${formatTime(message.timestamp)}`}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>

      {/* User indicator dot */}
      {isUser && (
        <div
          className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-3.5 ml-2.5"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
