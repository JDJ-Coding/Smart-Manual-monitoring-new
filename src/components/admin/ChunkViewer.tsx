"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, FileText, X, ChevronLeft, ChevronRight, Eye } from "lucide-react";

interface ChunkData {
  id: string;
  text: string;
  metadata: { filename: string; page: number; chunkIndex: number };
}

interface ChunkModalProps {
  chunk: ChunkData;
  onClose: () => void;
}

function ChunkModal({ chunk, onClose }: ChunkModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText size={14} className="text-blue-400 flex-shrink-0" />
            <span className="text-sm font-medium text-zinc-200 truncate">
              {chunk.metadata.filename}
            </span>
            <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 flex-shrink-0">
              p.{chunk.metadata.page}
            </span>
            <span className="text-xs text-zinc-600 flex-shrink-0">
              #{chunk.metadata.chunkIndex}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <pre className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
            {chunk.text}
          </pre>
        </div>
        <div className="px-5 py-3 border-t border-zinc-800 flex-shrink-0">
          <p className="text-xs text-zinc-600">{chunk.text.length.toLocaleString()}자</p>
        </div>
      </div>
    </div>
  );
}

export function ChunkViewer() {
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [filenames, setFilenames] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modalChunk, setModalChunk] = useState<ChunkData | null>(null);

  // 검색 디바운스
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const fetchChunks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFile) params.set("filename", selectedFile);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/chunks?${params}`);
      const data = await res.json();
      setChunks(data.chunks ?? []);
      setFilenames(data.filenames ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch {
      setChunks([]);
    } finally {
      setLoading(false);
    }
  }, [selectedFile, debouncedSearch, page]);

  useEffect(() => {
    fetchChunks();
  }, [fetchChunks]);

  // 검색/파일 변경 시 페이지 리셋
  useEffect(() => {
    setPage(1);
  }, [selectedFile, debouncedSearch]);

  return (
    <>
      <div className="space-y-3">
        {/* 필터 영역 */}
        <div className="flex flex-wrap gap-2">
          {/* 파일 선택 */}
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300
                       px-3 py-1.5 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="">전체 파일</option>
            {filenames.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          {/* 키워드 검색 */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="청크 내용 검색…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300
                         pl-7 pr-8 py-1.5 focus:outline-none focus:border-blue-500 placeholder:text-zinc-600 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* 결과 카운트 */}
        <p className="text-xs text-zinc-600">
          {loading ? "검색 중…" : `${total.toLocaleString()}개 청크`}
        </p>

        {/* 청크 목록 */}
        {chunks.length === 0 && !loading ? (
          <div className="text-center py-8 text-zinc-600 text-sm">
            {total === 0 ? "DB가 구축되지 않았거나 검색 결과가 없습니다." : ""}
          </div>
        ) : (
          <div className="space-y-1.5">
            {chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="flex items-start gap-3 bg-zinc-800/40 rounded-lg px-3 py-2.5 border border-zinc-700/30 hover:border-zinc-600/60 transition-all group"
              >
                <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20 whitespace-nowrap">
                    p.{chunk.metadata.page}
                  </span>
                  <span className="text-[10px] text-zinc-700">#{chunk.metadata.chunkIndex}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-600 truncate mb-1">
                    {chunk.metadata.filename}
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                    {chunk.text}
                  </p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <button
                    onClick={() => setModalChunk(chunk)}
                    className="p-1.5 rounded-md text-zinc-600 hover:text-blue-400 hover:bg-zinc-700 transition-all opacity-0 group-hover:opacity-100"
                    title="전체 내용 보기"
                  >
                    <Eye size={12} />
                  </button>
                  <span className="text-[10px] text-zinc-700">{chunk.text.length}자</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={13} />
              이전
            </button>
            <span className="text-xs text-zinc-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              다음
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {modalChunk && (
        <ChunkModal chunk={modalChunk} onClose={() => setModalChunk(null)} />
      )}
    </>
  );
}
