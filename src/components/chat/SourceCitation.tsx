"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, BookOpen } from "lucide-react";
import type { SourceReference } from "@/types";

interface Props {
  sources: SourceReference[];
}

/** Strips long path prefix, keeps basename only */
function shortName(filename: string): string {
  return filename.split(/[\\/]/).pop() ?? filename;
}

export function SourceCitation({ sources }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 pt-3 border-t border-zinc-700/40">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full text-left group"
        aria-expanded={expanded}
        aria-label={`참조 문서 ${sources.length}건 ${expanded ? "접기" : "펼치기"}`}
      >
        <BookOpen size={11} className="flex-shrink-0" />
        <span className="group-hover:text-zinc-300 transition-colors">
          참조 문서 <span className="text-blue-500 font-semibold">{sources.length}</span>건
        </span>
        <span className="ml-auto text-zinc-600">
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </span>
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1.5 animate-fadeIn" role="list">
          {sources.map((src, idx) => (
            <li
              key={`${src.filename}-${src.page}-${idx}`}
              className="flex items-start gap-2.5 bg-zinc-900/60 rounded-lg px-3 py-2.5 border border-zinc-700/30"
            >
              <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-600/20 text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <FileText size={10} className="text-zinc-600 flex-shrink-0" />
                  <p className="text-xs font-medium text-zinc-400 truncate">
                    {shortName(src.filename)}
                  </p>
                  <span className="text-[10px] font-medium text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20 flex-shrink-0">
                    p.{src.page}
                  </span>
                </div>
                {src.excerpt && (
                  <p className="text-xs text-zinc-600 mt-1 line-clamp-2 leading-relaxed pl-3.5">
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
