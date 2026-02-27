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

/** Renders AI markdown responses: headers, lists, bold, inline code, code blocks */
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

    // H1
    if (/^# /.test(line)) {
      output.push(
        <p key={i} className="text-base font-bold text-zinc-100 mt-3 mb-1">
          <InlineMarkdown text={line.slice(2)} />
        </p>
      );
      i++;
      continue;
    }

    // H2
    if (/^## /.test(line)) {
      output.push(
        <p key={i} className="text-sm font-bold text-zinc-200 mt-2.5 mb-1">
          <InlineMarkdown text={line.slice(3)} />
        </p>
      );
      i++;
      continue;
    }

    // H3
    if (/^### /.test(line)) {
      output.push(
        <p key={i} className="text-sm font-semibold text-zinc-300 mt-2 mb-0.5">
          <InlineMarkdown text={line.slice(4)} />
        </p>
      );
      i++;
      continue;
    }

    // Numbered list item  (1. 2. etc.)
    if (/^\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      output.push(
        <ol key={i} className="my-1.5 space-y-1 pl-1">
          {listItems.map((item, j) => (
            <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-zinc-200">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
                {j + 1}
              </span>
              <span><InlineMarkdown text={item} /></span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list item (- or *)
    if (/^[-*]\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        listItems.push(lines[i].slice(2));
        i++;
      }
      output.push(
        <ul key={i} className="my-1.5 space-y-1 pl-1">
          {listItems.map((item, j) => (
            <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-zinc-200">
              <span className="flex-shrink-0 w-1 h-1 rounded-full bg-blue-500 mt-2.5" />
              <span><InlineMarkdown text={item} /></span>
            </li>
          ))}
        </ul>
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
      <p key={i} className="text-sm leading-relaxed text-zinc-200">
        <InlineMarkdown text={line} />
      </p>
    );
    i++;
  }

  return <>{output}</>;
}

/** Renders inline markdown: bold, inline code */
function InlineMarkdown({ text }: { text: string }) {
  // Split on **bold** and `code`
  const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="font-mono text-xs bg-zinc-900/80 border border-zinc-700/40 rounded px-1.5 py-0.5 text-blue-300">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
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
            "relative rounded-2xl px-4 py-3 text-sm leading-relaxed group",
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-zinc-800 border border-zinc-700/60 text-zinc-200 rounded-tl-sm"
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <FormattedContent content={message.content} />
          )}

          {/* Copy button (AI messages only) */}
          {!isUser && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100
                         text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-all"
              title={copied ? "복사됨" : "복사"}
              aria-label={copied ? "복사됨" : "응답 복사"}
            >
              {copied ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          )}

          {/* Source citations */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <SourceCitation sources={message.sources} />
          )}
        </div>

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
