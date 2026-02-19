"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import type { SourceReference } from "@/types";

interface Props {
  sources: SourceReference[];
}

export function SourceCitation({ sources }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="source-box">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[#023E8A] font-semibold text-sm w-full text-left"
      >
        <BookOpen size={14} />
        <span>참조 문서 ({sources.length}개)</span>
        <span className="ml-auto">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <ul className="mt-3 space-y-2">
          {sources.map((src, idx) => (
            <li key={idx} className="border-l-2 border-[#00B4D8] pl-3">
              <p className="text-xs font-medium text-[#023E8A]">
                {src.filename} &middot; p.{src.page}
              </p>
              {src.excerpt && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {src.excerpt}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
