import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { parsePdfToChunks, listPdfFiles, getManualsDir } from "@/lib/pdfParser";
import { embedPassage } from "@/lib/embeddings";
import { saveVectorStore, clearVectorStoreCache, buildChunk } from "@/lib/vectorStore";
import path from "path";
import type { VectorStore } from "@/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const pdfFiles = listPdfFiles();
  if (pdfFiles.length === 0) {
    return NextResponse.json({
      success: false,
      message: "처리할 PDF 파일이 없습니다. 먼저 PDF를 업로드하세요.",
    });
  }

  const manualsDir = getManualsDir();
  const allChunks = [];
  const errors: string[] = [];

  for (const filename of pdfFiles) {
    const filePath = path.join(manualsDir, filename);
    try {
      const parsed = await parsePdfToChunks(filePath);
      for (const parsedChunk of parsed) {
        const embedding = await embedPassage(parsedChunk.text);
        allChunks.push(
          buildChunk(
            parsedChunk.text,
            embedding,
            filename,
            parsedChunk.page,
            parsedChunk.chunkIndex
          )
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${filename}: ${msg}`);
    }
  }

  if (allChunks.length === 0) {
    return NextResponse.json({
      success: false,
      message: "청크를 생성하지 못했습니다.",
      errors,
    });
  }

  const store: VectorStore = {
    version: 1,
    builtAt: new Date().toISOString(),
    totalChunks: allChunks.length,
    chunks: allChunks,
  };

  clearVectorStoreCache();
  saveVectorStore(store);

  return NextResponse.json({
    success: true,
    totalChunks: allChunks.length,
    filesProcessed: pdfFiles.length,
    errors,
    message: `DB 구축 완료: ${pdfFiles.length}개 파일, ${allChunks.length}개 청크`,
  });
}
