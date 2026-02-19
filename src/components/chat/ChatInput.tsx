"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
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

  return (
    <div className="flex items-end gap-2 bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-3 focus-within:border-[#023E8A] transition-colors">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={disabled}
        placeholder="설비 관련 질문을 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)"
        rows={1}
        className={clsx(
          "flex-1 outline-none text-sm leading-relaxed bg-transparent",
          "placeholder:text-gray-400",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className={clsx(
          "flex-shrink-0 p-2 rounded-xl transition-colors",
          disabled || !value.trim()
            ? "text-gray-300 cursor-not-allowed"
            : "text-[#023E8A] hover:bg-blue-50 cursor-pointer"
        )}
      >
        <SendHorizontal size={20} />
      </button>
    </div>
  );
}
