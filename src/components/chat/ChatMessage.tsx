import { SourceCitation } from "./SourceCitation";
import type { ChatMessage as ChatMessageType } from "@/types";
import { clsx } from "clsx";

interface Props {
  message: ChatMessageType;
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
                <strong key={j}>{part.slice(2, -2)}</strong>
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

  return (
    <div className={clsx("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#023E8A] flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      )}
      <div
        className={clsx(
          "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-[#023E8A] text-white rounded-br-md"
            : "bg-gray-50 border border-gray-200 text-gray-900 rounded-bl-md"
        )}
      >
        <div className="text-sm leading-relaxed">
          <FormattedContent content={message.content} />
        </div>
        {message.sources && message.sources.length > 0 && (
          <SourceCitation sources={message.sources} />
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-[#00B4D8] flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-white text-xs font-bold">나</span>
        </div>
      )}
    </div>
  );
}
