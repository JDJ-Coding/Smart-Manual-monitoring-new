"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, BookOpen, X, Maximize2 } from "lucide-react";
import type { SourceReference } from "@/types";

interface Props {
  sources: SourceReference[];
}

function shortName(filename: string): string {
  return filename.split(/[\\/]/).pop() ?? filename;
}

function FullTextModal({
  source,
  onClose,
}: {
  source: SourceReference;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText size={14} className="text-blue-400 flex-shrink-0" />
            <span className="text-sm font-medium text-zinc-100 truncate">
              {shortName(source.filename)}
            </span>
            <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 flex-shrink-0">
              p.{source.page}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-100 hover:text-zinc-100 transition-colors p-1 rounded flex-shrink-0"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap font-mono">
            {source.fullText ?? source.excerpt}
          </p>
        </div>
      </div>
    </div>
  );
}

export function SourceCitation({ sources }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [modalSource, setModalSource] = useState<SourceReference | null>(null);

  return (
    <>
      <div className="mt-3 pt-3 border-t border-zinc-700/40">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-zinc-100 hover:text-zinc-100 transition-colors w-full text-left group"
          aria-expanded={expanded}
          aria-label={`참조 문서 ${sources.length}건 ${expanded ? "접기" : "펼치기"}`}
        >
          <BookOpen size={11} className="flex-shrink-0" />
          <span className="group-hover:text-zinc-100 transition-colors">
            참조 문서 <span className="text-blue-500 font-semibold">{sources.length}</span>건
          </span>
          <span className="ml-auto text-zinc-100">
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
                    <FileText size={10} className="text-zinc-100 flex-shrink-0" />
                    <p className="text-xs font-medium text-zinc-100 truncate">
                      {shortName(src.filename)}
                    </p>
                    <span className="text-[10px] font-medium text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20 flex-shrink-0">
                      p.{src.page}
                    </span>
                    {/* 원문 보기 버튼 */}
                    {(src.fullText || src.excerpt) && (
                      <button
                        onClick={() => setModalSource(src)}
                        className="ml-auto flex items-center gap-1 text-[10px] text-zinc-100 hover:text-blue-400 transition-colors flex-shrink-0"
                        title="원문 전체 보기"
                        aria-label="원문 전체 보기"
                      >
                        <Maximize2 size={9} />
                        원문 보기
                      </button>
                    )}
                  </div>
                  {src.excerpt && (
                    <p className="text-xs text-zinc-100 mt-1 line-clamp-2 leading-relaxed pl-3.5">
                      {src.excerpt}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Full-text modal */}
      {modalSource && (
        <FullTextModal source={modalSource} onClose={() => setModalSource(null)} />
      )}
    </>
  );
}
