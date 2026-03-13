"use client";

import { useState } from "react";
import { Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
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

// ─── Inline markdown renderer ────────────────────────────────────────────────
// Supports: **bold**, *italic*, ~~strikethrough~~, `code`, [text](url)
function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  // Pattern priority: links first, then inline styles
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|\*\*(.+?)\*\*|\*([^*\n]+?)\*|~~(.+?)~~|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }

    const [full, , linkText, linkHref, boldText, italicText, strikeText, codeText] = m;

    if (linkHref) {
      parts.push(
        <a key={m.index} href={linkHref} target="_blank" rel="noopener noreferrer"
           className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
          {linkText}
        </a>
      );
    } else if (boldText !== undefined) {
      parts.push(<strong key={m.index} className="font-semibold text-zinc-100">{boldText}</strong>);
    } else if (italicText !== undefined) {
      parts.push(<em key={m.index} className="italic text-zinc-300">{italicText}</em>);
    } else if (strikeText !== undefined) {
      parts.push(<del key={m.index} className="line-through text-zinc-500">{strikeText}</del>);
    } else if (codeText !== undefined) {
      parts.push(
        <code key={m.index} className="font-mono text-xs bg-zinc-900/80 border border-zinc-700/40 rounded px-1.5 py-0.5 text-blue-300">
          {codeText}
        </code>
      );
    } else {
      parts.push(full);
    }
    last = m.index + full.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ─── Table renderer ───────────────────────────────────────────────────────────
function renderTable(tableLines: string[], key: number): React.ReactNode {
  const rows = tableLines.map((line) =>
    line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim())
  );
  if (rows.length < 2) return null;
  const headers = rows[0];
  const dataRows = rows.slice(2); // skip separator row

  return (
    <div key={key} className="my-3 overflow-x-auto rounded-lg border border-zinc-700/60">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-800/80">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-zinc-300 border-b border-zinc-700/60 whitespace-nowrap">
                <InlineMarkdown text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-zinc-900/40" : "bg-zinc-800/20"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-zinc-300 border-b border-zinc-800/40 last:border-b-0">
                  <InlineMarkdown text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main markdown block renderer ─────────────────────────────────────────────
function FormattedContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const output: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      output.push(
        <pre
          key={i}
          className="my-2 rounded-lg bg-zinc-900 border border-zinc-700/60 px-4 py-3 overflow-x-auto text-xs font-mono text-zinc-300 leading-relaxed"
        >
          {lang && (
            <span className="block text-zinc-600 text-[10px] mb-1 uppercase tracking-wider">
              {lang}
            </span>
          )}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      i++; // skip closing ```
      continue;
    }

    // Table: line starts with |
    if (/^\|.+\|/.test(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|.+\|/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      const tableNode = renderTable(tableLines, i);
      if (tableNode) output.push(tableNode);
      continue;
    }

    // H1
    if (/^# /.test(line)) {
      output.push(
        <p key={i} className="text-lg font-bold text-zinc-100 mt-3 mb-1">
          <InlineMarkdown text={line.slice(2)} />
        </p>
      );
      i++;
      continue;
    }

    // H2
    if (/^## /.test(line)) {
      output.push(
        <p key={i} className="text-base font-bold text-zinc-200 mt-2.5 mb-1">
          <InlineMarkdown text={line.slice(3)} />
        </p>
      );
      i++;
      continue;
    }

    // H3
    if (/^### /.test(line)) {
      output.push(
        <p key={i} className="text-base font-semibold text-zinc-300 mt-2 mb-0.5">
          <InlineMarkdown text={line.slice(4)} />
        </p>
      );
      i++;
      continue;
    }

    // Numbered list (supports nested indented items)
    if (/^\d+\.\s/.test(line)) {
      const listItems: { text: string; subItems: string[] }[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s/, "");
        const subItems: string[] = [];
        i++;
        // collect indented sub-items
        while (i < lines.length && /^(\s{2,}|\t)[-*]\s/.test(lines[i])) {
          subItems.push(lines[i].replace(/^(\s{2,}|\t)[-*]\s/, ""));
          i++;
        }
        listItems.push({ text: itemText, subItems });
      }
      output.push(
        <ol key={i} className="my-1.5 space-y-1.5 pl-1">
          {listItems.map((item, j) => (
            <li key={j} className="flex gap-2.5 text-base leading-relaxed text-zinc-200">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">
                {j + 1}
              </span>
              <span className="flex-1">
                <InlineMarkdown text={item.text} />
                {item.subItems.length > 0 && (
                  <ul className="mt-1 space-y-1 pl-2">
                    {item.subItems.map((sub, si) => (
                      <li key={si} className="flex gap-2 text-sm text-zinc-400">
                        <span className="w-1 h-1 rounded-full bg-zinc-600 mt-2 flex-shrink-0" />
                        <InlineMarkdown text={sub} />
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list (supports nested indented items)
    if (/^[-*]\s/.test(line)) {
      const listItems: { text: string; subItems: string[] }[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        const itemText = lines[i].slice(2);
        const subItems: string[] = [];
        i++;
        // collect indented sub-items
        while (i < lines.length && /^(\s{2,}|\t)[-*]\s/.test(lines[i])) {
          subItems.push(lines[i].replace(/^(\s{2,}|\t)[-*]\s/, ""));
          i++;
        }
        listItems.push({ text: itemText, subItems });
      }
      output.push(
        <ul key={i} className="my-1.5 space-y-1.5 pl-1">
          {listItems.map((item, j) => (
            <li key={j} className="flex gap-2.5 text-base leading-relaxed text-zinc-200">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5" />
              <span className="flex-1">
                <InlineMarkdown text={item.text} />
                {item.subItems.length > 0 && (
                  <ul className="mt-1 space-y-1 pl-2">
                    {item.subItems.map((sub, si) => (
                      <li key={si} className="flex gap-2 text-sm text-zinc-400">
                        <span className="w-1 h-1 rounded-full bg-zinc-600 mt-2 flex-shrink-0" />
                        <InlineMarkdown text={sub} />
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Blockquote
    if (/^>\s/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      output.push(
        <blockquote key={i} className="my-2 pl-3 border-l-2 border-blue-500/50 text-zinc-400 italic">
          {quoteLines.map((ql, qi) => (
            <p key={qi} className="text-sm leading-relaxed"><InlineMarkdown text={ql} /></p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      output.push(<hr key={i} className="my-2 border-zinc-700/60" />);
      i++;
      continue;
    }

    // Empty line → spacer
    if (line.trim() === "") {
      output.push(<div key={i} className="h-1.5" />);
      i++;
      continue;
    }

    // Regular paragraph
    output.push(
      <p key={i} className="text-base leading-relaxed text-zinc-200">
        <InlineMarkdown text={line} />
      </p>
    );
    i++;
  }

  return <>{output}</>;
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

      <div className="max-w-[82%]">
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
              className="absolute top-2 right-2 p-1.5 rounded-md
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
                  className="p-1 rounded text-zinc-600 hover:text-emerald-400 hover:bg-zinc-800 transition-all"
                  title="도움이 됐어요"
                  aria-label="좋은 답변"
                >
                  <ThumbsUp size={12} />
                </button>
                <button
                  onClick={() => setShowReasonPicker(!showReasonPicker)}
                  className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-all"
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
