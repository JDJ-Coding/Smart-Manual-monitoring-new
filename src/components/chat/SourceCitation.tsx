"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import type { SourceReference } from "@/types";

interface Props {
  sources: SourceReference[];
}

export function SourceCitation({ sources }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-zinc-700/40">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full text-left"
      >
        <FileText size={12} />
        <span>참조 문서 {sources.length}건</span>
        <span className="ml-auto">{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
      </button>

      {expanded && (
        <ul className="mt-2 space-y-2 animate-fadeIn">
          {sources.map((src, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 bg-zinc-900/60 rounded-lg px-3 py-2 border border-zinc-700/40"
            >
              <span className="flex-shrink-0 w-4 h-4 rounded bg-blue-600/20 text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-400 truncate">
                  {src.filename}
                  <span className="text-zinc-600 ml-1 font-normal">p.{src.page}</span>
                </p>
                {src.excerpt && (
                  <p className="text-xs text-zinc-600 mt-0.5 line-clamp-2 leading-relaxed">
                    {src.excerpt}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
