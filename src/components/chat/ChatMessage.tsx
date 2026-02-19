import { SourceCitation } from "./SourceCitation";
import type { ChatMessage as ChatMessageType } from "@/types";
import { clsx } from "clsx";

interface Props {
  message: ChatMessageType;
}

function formatContent(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
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
        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
        />
        {message.sources && message.sources.length > 0 && (
          <SourceCitation sources={message.sources} />
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-gray-600 text-xs font-bold">나</span>
        </div>
      )}
    </div>
  );
}
