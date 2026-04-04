import { NextRequest } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { parsePdfToChunks, listPdfFiles, getManualsDir } from "@/lib/pdfParser";
import { embedPassage } from "@/lib/embeddings";
import { saveVectorStore, clearVectorStoreCache, buildChunk, setBuildInProgress } from "@/lib/vectorStore";
import { summarizeChunkContext } from "@/lib/poscoGpt";
import { detectLanguage, translateToKorean } from "@/lib/pdfTranslator";
import { appendAdminLog, cleanOldAdminLogs, extractRequestMeta } from "@/lib/adminLogger";
import path from "path";
import type { VectorStore, TextChunk, ParseReport } from "@/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return new Response(
      JSON.stringify({ error: "인증이 필요합니다." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  void cleanOldAdminLogs();
  const { ip, userAgent } = extractRequestMeta(req);

  const pdfFiles = listPdfFiles();
  if (pdfFiles.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "처리할 PDF 파일이 없습니다. 먼저 PDF를 업로드하세요.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Contextual Retrieval: CONTEXTUAL_RETRIEVAL=true 환경변수로 활성화
  const useContextualRetrieval = process.env.CONTEXTUAL_RETRIEVAL === "true";
  // PDF 번역: PDF_TRANSLATE=true 환경변수로 활성화 (DB 빌드 시간 증가)
  const usePdfTranslate = process.env.PDF_TRANSLATE === "true";

  const encoder = new TextEncoder();
  const manualsDir = getManualsDir();

  // ── Build Lock 설정: 구축 시작 ──────────────────────────────────────────────
  setBuildInProgress(true);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      appendAdminLog({
        timestamp: new Date().toISOString(),
        action: "BUILD_DB_START",
        detail: `대상 파일 ${pdfFiles.length}개`,
        ip,
        userAgent,
        success: true,
        error: null,
      });

      const allChunks: TextChunk[] = [];
      const errors: string[] = [];
      const report: ParseReport[] = [];

      // 파일 단위 처리 함수 (동시 최대 CONCURRENCY개)
      const CONCURRENCY = 3;
      let completedFiles = 0;

      async function processFile(
        filename: string,
        fileIdx: number
      ): Promise<void> {
        const filePath = path.join(manualsDir, filename);

        send({
          type: "progress",
          file: filename,
          fileIndex: fileIdx + 1,
          totalFiles: pdfFiles.length,
          phase: "parsing",
          chunks: allChunks.length,
        });

        try {
          const { chunks: parsed, totalPages } = await parsePdfToChunks(filePath);

          const fileChunks: TextChunk[] = [];
          let totalLen = 0;

          for (let ci = 0; ci < parsed.length; ci++) {
            const parsedChunk = parsed[ci];
            let textToEmbed = parsedChunk.text;

            // 번역 단계 (PDF_TRANSLATE=true 시에만)
            if (usePdfTranslate && detectLanguage(parsedChunk.text)) {
              send({
                type: "progress",
                phase: "translating",
                file: filename,
                pageIndex: parsedChunk.page,
                totalPages,
              });
              try {
                textToEmbed = await translateToKorean(parsedChunk.text, filename);
              } catch {
                // 번역 실패 시 원문 사용 (non-blocking)
                console.error(`[build-db] 번역 실패 (${filename} p.${parsedChunk.page}) — 원문 사용`);
              }
            }

            if (useContextualRetrieval) {
              const ctx = await summarizeChunkContext(textToEmbed, filename);
              if (ctx) textToEmbed = `${ctx}\n\n${textToEmbed}`;
            }

            const embedding = await embedPassage(textToEmbed);
            const chunk = buildChunk(
              textToEmbed,
              embedding,
              filename,
              parsedChunk.page,
              parsedChunk.chunkIndex,
              {
                isTable: parsedChunk.isTable,
                isAlarmRelated: parsedChunk.isAlarmRelated,
                extractedCodes: parsedChunk.extractedCodes,
                language: parsedChunk.language,
              }
            );
            fileChunks.push(chunk);
            totalLen += parsedChunk.text.length;

            if (ci % 10 === 0) {
              send({
                type: "progress",
                file: filename,
                fileIndex: fileIdx + 1,
                totalFiles: pdfFiles.length,
                phase: "embedding",
                fileProgress: Math.round((ci / parsed.length) * 100),
                chunks: allChunks.length + fileChunks.length,
              });
            }
          }

          allChunks.push(...fileChunks);
          report.push({
            filename,
            totalPages,
            totalChunks: fileChunks.length,
            avgChunkLength: fileChunks.length > 0 ? Math.round(totalLen / fileChunks.length) : 0,
            hasWarning: fileChunks.length === 0,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          errors.push(`${filename}: ${msg}`);
          report.push({ filename, totalPages: 0, totalChunks: 0, avgChunkLength: 0, hasWarning: true });
        } finally {
          completedFiles++;
          send({
            type: "progress",
            phase: "overall",
            completedFiles,
            totalFiles: pdfFiles.length,
            chunks: allChunks.length,
          });
        }
      }

      // 세마포어 패턴으로 병렬 처리 (동시 최대 CONCURRENCY개)
      const queue = pdfFiles.map((filename, idx) => () => processFile(filename, idx));
      const running: Promise<void>[] = [];

      for (const task of queue) {
        const p = task().then(() => {
          running.splice(running.indexOf(p), 1);
        });
        running.push(p);
        if (running.length >= CONCURRENCY) {
          await Promise.race(running);
        }
      }
      await Promise.all(running);

      if (allChunks.length === 0) {
        const reason =
          errors.length > 0
            ? "모든 파일 처리에 실패했습니다."
            : "PDF에서 텍스트를 추출하지 못했습니다. 이미지 전용 PDF일 수 있습니다.";
        const errorMsg = `청크를 생성하지 못했습니다. ${reason}`;

        appendAdminLog({
          timestamp: new Date().toISOString(),
          action: "BUILD_DB_FAIL",
          detail: errorMsg,
          ip,
          userAgent,
          success: false,
          error: errorMsg,
        });

        send({
          type: "done",
          success: false,
          message: errorMsg,
          errors,
          report,
        });
      } else {
        const store: VectorStore = {
          version: 1,
          builtAt: new Date().toISOString(),
          totalChunks: allChunks.length,
          chunks: allChunks,
        };

        clearVectorStoreCache();
        saveVectorStore(store);

        appendAdminLog({
          timestamp: new Date().toISOString(),
          action: "BUILD_DB_COMPLETE",
          detail: `총 ${allChunks.length}청크, ${pdfFiles.length}개 파일 처리 완료`,
          ip,
          userAgent,
          success: true,
          error: null,
        });

        send({
          type: "done",
          success: true,
          totalChunks: allChunks.length,
          filesProcessed: pdfFiles.length,
          errors,
          report,
          message: `DB 구축 완료: ${pdfFiles.length}개 파일, ${allChunks.length}개 청크`,
        });
      }

      // ── Build Lock 해제: 구축 완료 또는 실패 후 ───────────────────────────
      setBuildInProgress(false);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
