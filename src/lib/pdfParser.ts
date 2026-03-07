import fs from "fs";
import path from "path";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 300;

export interface ParsedChunk {
  text: string;
  page: number;
  chunkIndex: number;
  filename: string;
}

async function extractPageTexts(filePath: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const dataBuffer = fs.readFileSync(filePath);

  const pageTexts: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pdfParse(dataBuffer, {
    // pagerender receives the PDF.js page object; we capture text per page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pagerender: (pageData: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return pageData.getTextContent().then((textContent: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = textContent.items.map((item: any) => item.str ?? "").join(" ");
        pageTexts.push(text);
        return text;
      });
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return pageTexts;
}

function splitTextWithOverlap(
  text: string,
  page: number,
  filename: string,
  startIndex: number
): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  let offset = 0;
  let chunkIndex = startIndex;

  while (offset < text.length) {
    const end = Math.min(offset + CHUNK_SIZE, text.length);
    const chunk = text.slice(offset, end).trim();

    if (chunk.length > 50) {
      chunks.push({ text: chunk, page, chunkIndex, filename });
      chunkIndex++;
    }

    if (end === text.length) break;
    offset += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

export async function parsePdfToChunks(filePath: string): Promise<ParsedChunk[]> {
  const filename = path.basename(filePath);
  const pageTexts = await extractPageTexts(filePath);

  const allChunks: ParsedChunk[] = [];
  let globalChunkIndex = 0;

  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i].trim();
    if (!pageText) continue;

    const chunks = splitTextWithOverlap(pageText, i + 1, filename, globalChunkIndex);
    allChunks.push(...chunks);
    globalChunkIndex += chunks.length;
  }

  return allChunks;
}

export function getManualsDir(): string {
  return path.join(process.cwd(), "data", "manuals");
}

export function listPdfFiles(): string[] {
  const dir = getManualsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf"));
}
