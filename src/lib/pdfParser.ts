import fs from "fs";
import path from "path";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 300;
const MIN_CHUNK_LENGTH = 50;

export interface ParsedChunk {
  text: string;
  page: number;
  chunkIndex: number;
  filename: string;
}

async function extractPageTexts(filePath: string): Promise<{ texts: string[]; totalPages: number }> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const dataBuffer = fs.readFileSync(filePath);

  const pageTexts: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pdfParse(dataBuffer, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pagerender: (pageData: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return pageData.getTextContent().then((textContent: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = textContent.items
          .map((item: any) => item.str ?? "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pageTexts.push(text);
        return text;
      });
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return { texts: pageTexts, totalPages: pageTexts.length };
}

/**
 * 문장 경계 기반 청킹
 * CHUNK_SIZE 이상 누적 시 가장 가까운 문장 끝에서 분할
 * 오버랩은 이전 청크 뒤쪽 CHUNK_OVERLAP자
 */
function splitTextWithSentenceBoundary(
  text: string,
  page: number,
  filename: string,
  startIndex: number
): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  let chunkIndex = startIndex;
  let offset = 0;

  // 문장 끝 패턴
  const sentenceEndPattern = /([.!?。]\s+|[\n\r]+)/g;

  while (offset < text.length) {
    const targetEnd = offset + CHUNK_SIZE;

    if (targetEnd >= text.length) {
      const chunk = text.slice(offset).trim();
      if (chunk.length >= MIN_CHUNK_LENGTH) {
        chunks.push({ text: chunk, page, chunkIndex, filename });
        chunkIndex++;
      }
      break;
    }

    // targetEnd ± 200 범위에서 문장 경계 탐색
    const searchStart = Math.max(offset + CHUNK_SIZE - 200, offset + MIN_CHUNK_LENGTH);
    const searchEnd = Math.min(targetEnd + 200, text.length);
    const searchText = text.slice(searchStart, searchEnd);

    let bestBoundary = -1;
    let m: RegExpExecArray | null;
    sentenceEndPattern.lastIndex = 0;
    while ((m = sentenceEndPattern.exec(searchText)) !== null) {
      const pos = searchStart + m.index + m[0].length;
      if (pos > offset + MIN_CHUNK_LENGTH) {
        bestBoundary = pos;
        if (pos >= targetEnd) break;
      }
    }

    const splitPos = bestBoundary > offset ? bestBoundary : targetEnd;
    const chunk = text.slice(offset, splitPos).trim();
    if (chunk.length >= MIN_CHUNK_LENGTH) {
      chunks.push({ text: chunk, page, chunkIndex, filename });
      chunkIndex++;
    }

    const nextOffset = Math.max(splitPos - CHUNK_OVERLAP, offset + 1);
    offset = nextOffset;
  }

  return chunks;
}

export interface PdfParseResult {
  chunks: ParsedChunk[];
  totalPages: number;
  failedPages: number[];
}

export async function parsePdfToChunks(filePath: string): Promise<PdfParseResult> {
  const filename = path.basename(filePath);
  const { texts: pageTexts, totalPages } = await extractPageTexts(filePath);

  const allChunks: ParsedChunk[] = [];
  const failedPages: number[] = [];
  let globalChunkIndex = 0;

  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i].trim();
    if (!pageText) {
      failedPages.push(i + 1);
      continue;
    }

    const chunks = splitTextWithSentenceBoundary(pageText, i + 1, filename, globalChunkIndex);
    if (chunks.length === 0) {
      failedPages.push(i + 1);
    }
    allChunks.push(...chunks);
    globalChunkIndex += chunks.length;
  }

  return { chunks: allChunks, totalPages, failedPages };
}

export function getManualsDir(): string {
  return path.join(process.cwd(), "data", "manuals");
}

export function listPdfFiles(): string[] {
  const dir = getManualsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf"));
}
