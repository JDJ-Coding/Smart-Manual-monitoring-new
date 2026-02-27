"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="space-y-1.5">
      <div
        className={clsx(
          "flex items-end gap-2 rounded-2xl border px-4 py-3 transition-all",
          "bg-zinc-800/80",
          disabled
            ? "border-zinc-700/50 opacity-60"
            : value.trim()
              ? "border-zinc-600 shadow-sm shadow-blue-900/20"
              : "border-zinc-700 focus-within:border-zinc-500"
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={disabled ? "DB를 구축하면 질문할 수 있습니다." : "설비 관련 질문을 입력하세요…"}
          rows={1}
          aria-label="질문 입력"
          aria-disabled={disabled}
          className={clsx(
            "flex-1 bg-transparent outline-none text-sm leading-relaxed text-zinc-200",
            "placeholder:text-zinc-600",
            disabled && "cursor-not-allowed"
          )}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="전송"
          className={clsx(
            "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all",
            canSend
              ? "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-sm"
              : "bg-zinc-700/50 text-zinc-600 cursor-not-allowed"
          )}
          title="전송 (Enter)"
        >
          <ArrowUp size={16} />
        </button>
      </div>
      {!disabled && (
        <p className="text-[11px] text-zinc-700 text-right pr-1">
          Enter 전송 &nbsp;·&nbsp; Shift+Enter 줄바꿈
        </p>
      )}
    </div>
  );
}
