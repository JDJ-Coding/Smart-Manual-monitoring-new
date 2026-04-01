"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

const ALARM_CODE_PATTERN = /\b[A-Z]{1,4}[.\-][A-Z0-9]{0,4}$/;

export function ChatInput({ onSend, disabled = false }: Props) {
  const [value, setValue] = useState("");
  const [alarmCodes, setAlarmCodes] = useState<string[]>([]);
  const [showAlarmHint, setShowAlarmHint] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 마운트 시 알람 코드 목록 fetch
  useEffect(() => {
    fetch("/api/alarm-codes")
      .then((r) => r.json())
      .then((d: { codes?: string[] }) => setAlarmCodes(d.codes ?? []))
      .catch(() => {});
  }, []);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    setShowAlarmHint(false);
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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    // 알람 코드 패턴 감지
    if (alarmCodes.length > 0 && ALARM_CODE_PATTERN.test(v.toUpperCase())) {
      setShowAlarmHint(true);
    } else {
      setShowAlarmHint(false);
    }
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="space-y-1.5">
      {/* 알람 코드 감지 힌트 */}
      {showAlarmHint && (
        <p className="text-xs text-blue-400 bg-blue-500/10 rounded px-2 py-0.5 animate-fadeIn">
          알람 코드 감지됨 → 그대로 전송하면 DB에서 직접 조회합니다
        </p>
      )}
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
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={disabled ? "DB를 구축하면 질문할 수 있습니다." : "설비 관련 질문을 입력하세요."}
          rows={1}
          aria-label="질문 입력"
          aria-describedby="chat-input-hint"
          aria-disabled={disabled}
          className={clsx(
            "flex-1 bg-transparent outline-none text-base leading-relaxed text-zinc-100",
            disabled ? "placeholder:text-zinc-600 cursor-not-allowed" : "placeholder:text-zinc-500"
          )}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="전송"
          className={clsx(
            "flex-shrink-0 w-10 h-10 md:w-8 md:h-8 rounded-xl flex items-center justify-center transition-all",
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
        <p id="chat-input-hint" className="hidden md:block text-[11px] text-zinc-500 text-right pr-1">
          Enter 전송 &nbsp;·&nbsp; Shift+Enter 줄바꿈
        </p>
      )}
    </div>
  );
}
