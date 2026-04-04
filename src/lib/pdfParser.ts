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
  isTable?: boolean;
  isAlarmRelated?: boolean;
  extractedCodes?: string[];
  language?: "ko" | "en" | "mixed";
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
 * 알람/파라미터 코드 추출 (범용)
 * E.OC1, Pr.79, AL.16, F0001, W001, ALM-001 등 다양한 산업 코드 형식 지원
 */
function extractCodes(text: string): string[] {
  const patterns = [
    /\b[A-Z]{1,4}\.[A-Z0-9]{1,8}(?:\.[A-Z0-9]{1,4})?\b/g,   // E.OC1, Pr.79, AL.10, AL.10.1, AL.8D.1
    /\b[A-Z]{1,4}-[A-Z0-9]{2,8}\b/g,    // AL-001, F-001
    /\b[EFALWSCGB]\d{3,6}\b/g,          // F0001, W001, E001 (Siemens/ABB 계열)
    /\bALM-?\d{1,6}\b/gi,               // ALM001, ALM-001 (Fanuc 계열)
    /(?:알람|경보|alarm|alm|에러|error|fault)\s*\d{1,6}/gi, // 알람 13, Alarm 13
  ];
  const all: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern) ?? [];
    all.push(...matches);
  }
  return [...new Set(all)];
}

/**
 * 텍스트의 언어 판별
 * ASCII 알파벳 비율 >60% → 영어, <20% → 한국어, 나머지 → 혼합
 */
function detectTextLanguage(text: string): "ko" | "en" | "mixed" {
  const total = text.replace(/\s/g, "").length;
  if (total === 0) return "ko";
  const asciiAlpha = (text.match(/[A-Za-z]/g) ?? []).length;
  const ratio = asciiAlpha / total;
  if (ratio > 0.6) return "en";
  if (ratio < 0.2) return "ko";
  return "mixed";
}

/**
 * 구조화된 테이블 행 감지 (범용)
 * 예: "E.OC1  Overcurrent trip  16  23", "F0001  모터 과부하  5"
 *     "13  과전류 트립  원인: ...", "No.13  과전압"
 * 코드 형식으로 시작하고, 2개 이상 공백으로 구분된 열이 있는 행
 */
function isStructuredTableRow(line: string): boolean {
  const t = line.trim();
  return (
    // 알파벳 코드 시작: E.OC1, F0001, AL-13, AL.10.1 등
    /^[A-Z][A-Z0-9.\-]{0,12}\s{2,}.{3,}/.test(t) ||
    // 숫자 코드 시작: "13  과전류", "001  모터과부하"
    /^\d{1,6}\s{2,}.{3,}/.test(t) ||
    // No./번호 형식: "No.13  과전류", "번호 13  에러"
    /^(?:No\.?\s*|번호\s*)\d{1,6}\s+.{3,}/.test(t)
  );
}

/**
 * 알람 단일 행 → 독립 청크로 변환
 * 각 알람 항목이 자체 청크를 가져야 "알람 13" 검색 시 정확히 히트됨
 */
function formatSingleAlarmEntry(
  row: string,
  page: number,
  filename: string,
  chunkIndex: number
): ParsedChunk {
  const parts = row.trim().split(/\s{2,}|\t/);
  let text: string;
  if (parts.length >= 2) {
    const code = parts[0];
    const description = parts[1];
    const rest = parts.slice(2).join(" ");
    text = `[알람/파라미터]\n코드: ${code}\n내용: ${description}${rest ? `\n데이터: ${rest}` : ""}`;
  } else {
    text = `[알람/파라미터]\n${row.trim()}`;
  }
  const codes = extractCodes(text);
  return {
    text,
    page,
    chunkIndex,
    filename,
    isTable: true,
    isAlarmRelated: true, // 테이블 행은 항상 알람 관련으로 플래그
    extractedCodes: codes.length > 0 ? codes : undefined,
    language: detectTextLanguage(text),
  };
}

/**
 * 페이지 텍스트에서 알람 테이블 구간을 검출하고 분리
 * 반환: { tableChunks, remainingText }
 */
function extractTableChunks(
  text: string,
  page: number,
  filename: string,
  startIndex: number
): { tableChunks: ParsedChunk[]; remainingText: string; nextChunkIndex: number } {
  const lines = text.split(/\n|\r\n?/);
  const tableChunks: ParsedChunk[] = [];
  const nonTableLines: string[] = [];
  let chunkIndex = startIndex;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isStructuredTableRow(line)) {
      // 연속된 알람 테이블 행 수집
      const tableRows: string[] = [line];
      i++;
      while (i < lines.length && isStructuredTableRow(lines[i])) {
        tableRows.push(lines[i]);
        i++;
      }
      if (tableRows.length >= 2) {
        // 핵심 변경: 각 행을 독립 청크로 분리
        // → "알람 13" 검색 시 13번 전용 청크가 정확히 히트됨
        for (const row of tableRows) {
          tableChunks.push(formatSingleAlarmEntry(row, page, filename, chunkIndex));
          chunkIndex++;
        }
      } else {
        // 1행이면 일반 텍스트로 처리
        nonTableLines.push(...tableRows);
      }
    } else {
      nonTableLines.push(line);
      i++;
    }
  }

  return {
    tableChunks,
    remainingText: nonTableLines.join("\n"),
    nextChunkIndex: chunkIndex,
  };
}

/**
 * 문장 경계 기반 청킹
 * CHUNK_SIZE 이상 누적 시 가장 가까운 문장 끝에서 분할
 * 오버랩은 이전 청크 뒤쪽 CHUNK_OVERLAP자
 *
 * [핵심 기능] 알람 섹션 코드 carry-forward:
 * PDF의 "알람 코드 요약 테이블"과 "상세 원인/조치 설명"은 수백 줄 떨어진 다른 섹션에 위치함.
 * 상세 설명 섹션에서 청크가 분할되면 연속 청크에는 알람 코드가 없어 검색 미스 발생.
 * → 행 맨 앞에 알람 코드가 나타나면 해당 섹션의 모든 연속 청크에 [CODE] 프리픽스 주입.
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

  // ── 알람 섹션 경계 감지 ────────────────────────────────────────────────────
  // 행 맨 앞에 알람 코드 패턴이 나타나면 새 알람 섹션 시작으로 간주
  // 예: "E.OV2 Regenerative...", "AL.10 Undervoltage...", "AL.10.1 ..."
  const ALARM_SECTION_RE = /(?:^|\n)([A-Z]{1,4}\.[A-Z0-9]{1,8}(?:\.[A-Z0-9]{1,4})?)\s/g;
  const alarmSections: Array<{ start: number; code: string }> = [];
  let sm: RegExpExecArray | null;
  while ((sm = ALARM_SECTION_RE.exec(text)) !== null) {
    alarmSections.push({ start: sm.index, code: sm[1] });
  }

  // offset이 속한 알람 섹션의 코드 반환 (없으면 null)
  const getAlarmSectionCode = (pos: number): string | null => {
    let current: string | null = null;
    for (const s of alarmSections) {
      if (s.start <= pos) current = s.code;
      else break;
    }
    return current;
  };

  // 문장 끝 패턴
  const sentenceEndPattern = /([.!?。]\s+|[\n\r]+)/g;

  while (offset < text.length) {
    const targetEnd = offset + CHUNK_SIZE;

    if (targetEnd >= text.length) {
      const raw = text.slice(offset).trim();
      if (raw.length >= MIN_CHUNK_LENGTH) {
        const sectionCode = getAlarmSectionCode(offset);
        // 연속 청크이고 알람 코드가 없으면 프리픽스 주입 → 검색 시 히트 가능
        const chunkText =
          sectionCode && !raw.startsWith(sectionCode)
            ? `[${sectionCode}] ` + raw
            : raw;
        const codes = extractCodes(chunkText);
        chunks.push({
          text: chunkText,
          page,
          chunkIndex,
          filename,
          isAlarmRelated: codes.length > 0,
          extractedCodes: codes.length > 0 ? codes : undefined,
          language: detectTextLanguage(raw),
        });
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
    const raw = text.slice(offset, splitPos).trim();
    if (raw.length >= MIN_CHUNK_LENGTH) {
      const sectionCode = getAlarmSectionCode(offset);
      const chunkText =
        sectionCode && !raw.startsWith(sectionCode)
          ? `[${sectionCode}] ` + raw
          : raw;
      const codes = extractCodes(chunkText);
      chunks.push({
        text: chunkText,
        page,
        chunkIndex,
        filename,
        isAlarmRelated: codes.length > 0,
        extractedCodes: codes.length > 0 ? codes : undefined,
        language: detectTextLanguage(raw),
      });
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

    // 알람 테이블 구간 추출 (table-aware chunking)
    const { tableChunks, remainingText, nextChunkIndex } = extractTableChunks(
      pageText,
      i + 1,
      filename,
      globalChunkIndex
    );

    allChunks.push(...tableChunks);
    globalChunkIndex = nextChunkIndex;

    // 나머지 텍스트 일반 청킹
    const regularChunks = splitTextWithSentenceBoundary(
      remainingText,
      i + 1,
      filename,
      globalChunkIndex
    );

    if (tableChunks.length === 0 && regularChunks.length === 0) {
      failedPages.push(i + 1);
    }

    allChunks.push(...regularChunks);
    globalChunkIndex += regularChunks.length;
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
