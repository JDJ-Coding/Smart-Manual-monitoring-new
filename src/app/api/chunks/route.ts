import { NextRequest, NextResponse } from "next/server";
import { loadVectorStore } from "@/lib/vectorStore";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename") || undefined;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
  const search = searchParams.get("search")?.toLowerCase() || "";

  const store = loadVectorStore();
  if (!store) {
    return NextResponse.json({ chunks: [], total: 0, totalChunks: 0 });
  }

  let chunks = store.chunks.map((c) => ({
    id: c.id,
    text: c.text,
    metadata: c.metadata,
    // embedding 제외 (크기 절약)
  }));

  // 파일 필터
  if (filename) {
    chunks = chunks.filter((c) => c.metadata.filename === filename);
  }

  // 키워드 검색
  if (search) {
    chunks = chunks.filter((c) => c.text.toLowerCase().includes(search));
  }

  const total = chunks.length;
  const offset = (page - 1) * limit;
  const paginated = chunks.slice(offset, offset + limit);

  // 파일별 목록 (드롭다운용)
  const filenameSet: Record<string, true> = {};
  store.chunks.forEach((c) => { filenameSet[c.metadata.filename] = true; });
  const filenames = Object.keys(filenameSet);

  return NextResponse.json({
    chunks: paginated,
    total,
    totalChunks: store.totalChunks,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    filenames,
  });
}
