import { NextRequest } from "next/server";
import { embedText } from "@/lib/embeddings";
import { searchVectorStore, expandWithNeighbors } from "@/lib/vectorStore";
import { runLangChainAgent } from "@/lib/langchain/agent";
import { appendQueryLog, cleanOldQueryLogs } from "@/lib/queryLogger";
import { extractRequestMeta } from "@/lib/adminLogger";
import type { SourceReference, SearchResult } from "@/types";

export const maxDuration = 60;

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

function buildContextualQuery(question: string, history: HistoryMessage[]): string {
  if (!history || history.length === 0) return question;
  const recentUserMsgs = history
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content);
  if (recentUserMsgs.length === 0) return question;
  return [...recentUserMsgs, question].join(" ");
}

function buildContextPromptFromResults(
  results: Array<{
    score: number;
    chunk: { text: string; metadata: { filename: string; page: number } };
  }>
): { contextPrompt: string; sources: SourceReference[] } {
  if (!results.length) {
    return {
      contextPrompt:
        "검색된 매뉴얼 컨텍스트가 없습니다. 일반 지식으로 답변하되, 단정은 피하고 불확실하면 명시하세요.",
      sources: [],
    };
  }

  const seen = new Set<string>();
  const sources: SourceReference[] = [];

  const contextParts = results.map((r, idx) => {
    const { filename, page } = r.chunk.metadata;
    const key = `${filename}::${page}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({
        filename,
        page,
        excerpt: r.chunk.text.slice(0, 150),
        fullText: r.chunk.text,
      });
    }
    return `[참고${idx + 1}] ${filename} — ${page}페이지\n${r.chunk.text}`;
  });

  return {
    contextPrompt: `[매뉴얼 검색 결과] 아래 내용을 우선 참고하여 답변하세요. 참고 번호([참고N])를 인용할 수 있습니다.

⚠️ 답변 규칙 (반드시 준수):
① 답변에 사용하는 모든 정보는 아래 검색 결과에서 직접 인용 가능한 내용이어야 합니다.
② 아래 결과에 특정 알람/코드 번호가 없다면 "이번 검색 결과에 해당 항목이 포함되지 않았습니다"라고 명확히 말하세요. 절대로 해당 항목이 매뉴얼에 '존재하지 않는다'고 단정하지 마세요.
③ 인접한 번호(예: 12, 14)가 있다고 해서 특정 번호(예: 13)의 존재 여부를 추측하지 마세요.

${contextParts.join("\n\n---\n\n")}`,
    sources,
  };
}

function buildSystemPrompt(): string {
  return `당신은 POSCO Future M 스마트 매뉴얼 도우미입니다. 산업 설비(인버터, 서보, PLC 등) 유지보수 전문 AI입니다.

## 답변 원칙
1. 검색된 매뉴얼 내용이 있으면 반드시 해당 내용을 기반으로 답변하세요.
2. 알람/에러 코드 질문은 반드시 아래 구조로 답변하세요:
   🔴 알람 의미: 해당 알람이 나타내는 상태
   📋 발생 원인: 구체적인 원인 (번호 목록)
   🔧 조치 방법: 단계별 해결 절차 (번호 목록)
   📄 참고: 관련 파라미터 및 매뉴얼 페이지
3. 파라미터 질문은 파라미터 번호, 기능, 설정 범위, 초기값을 포함하세요.
4. 점검/유지보수 질문은 점검 항목, 주기, 방법을 구체적으로 안내하세요.
5. 매뉴얼에 없는 내용은 전문 지식으로 답변하되 "매뉴얼에서 확인되지 않은 내용입니다"를 명시하세요.
6. 표 데이터는 마크다운 표 또는 번호 목록으로 가독성 있게 정리하세요.
7. 모든 답변은 한국어로 작성하세요.
- 계산이 필요하면 calculator 도구를 사용하세요.
- 단위 변환이 필요하면 unit_converter 도구를 사용하세요.
- 알람 코드 조회가 필요하면 alarm_lookup 도구를 사용하세요.

## 검색 결과 해석 주의사항 (매우 중요)
- 검색된 컨텍스트에 특정 알람/에러 번호가 포함되지 않았다고 해서 해당 코드가 매뉴얼에 존재하지 않는다고 절대 단정하지 마세요.
- 검색은 유사도 기반이므로 인접한 번호(예: 12, 14)가 검색되었다고 해서 특정 번호(예: 13)가 없다는 의미가 아닙니다.
- 컨텍스트에서 요청한 알람 정보를 찾지 못한 경우: "검색된 범위에서 해당 알람 정보를 확인하지 못했습니다. 매뉴얼 원본을 직접 확인하시거나, DB 재구축 후 다시 질문해 주세요."라고 안내하세요.
- 주변 알람 번호의 검색 결과를 근거로 특정 번호의 존재 여부를 추측하지 마세요.

## 절대 금지
- 매뉴얼에 없는 내용 창작 또는 추측 금지
- 안전 관련 절차 임의 변경 또는 생략 금지
- 검색 미스를 "해당 알람이 존재하지 않습니다"로 단정하는 것 금지`;
}

function enhanceQueryForSearch(question: string): string {
  // 범용 산업 코드 패턴: E.OC1, Pr.79, AL.16, F0001, W001, ALM-001 등
  const codePattern = /\b([A-Z]{1,4}[.\-][A-Z0-9]{1,8}|[EFALWSCGB]\d{3,6}|ALM-?\d+)\b/gi;
  const codeMatches = question.match(codePattern) || [];

  // 공백+숫자 형식 알람 패턴: "알람 13", "alarm 13", "에러 13", "경보 13", "No.13" 등
  const numericAlarmRe = /(?:알람|경보|알람코드|alarm|alm|에러|error|fault|no\.?)\s*(\d+)/gi;
  const numericTerms: string[] = [];
  let nm: RegExpExecArray | null;
  while ((nm = numericAlarmRe.exec(question)) !== null) {
    numericTerms.push(nm[0].replace(/\s+/g, " ").trim()); // 예: "alarm 13"
    numericTerms.push(nm[1]); // 숫자만: "13"
  }

  const allTerms = [...codeMatches, ...numericTerms];
  if (allTerms.length > 0) {
    return `${question} 알람 에러 고장 원인 조치 ${allTerms.join(" ")}`;
  }
  return question;
}

/** 스코어 임계값 — 고정값 사용으로 일관성 보장 */
function computeDynamicThreshold(_scores: number[]): number {
  return 0.25;
}

/** 알람/에러 번호 직접 조회 쿼리인지 감지 */
function detectAlarmQuery(question: string): boolean {
  return (
    // 숫자형 알람: "알람 13", "fault 001"
    /(?:알람|경보|alarm|alm|에러|error|fault)\s*\d+/i.test(question) ||
    /\d+\s*(?:번\s*알람|번\s*에러|호\s*알람|번\s*경보)/i.test(question) ||
    /(?:알람|alarm)\s*(?:코드|code)?\s*\d+/i.test(question) ||
    // 알파벳 코드형 알람: E.OV2, E.OC1, Pr.79, AL-16, F0001 등
    /\b[A-Z]{1,4}[.\-][A-Z0-9]{1,8}\b/i.test(question) ||
    /\b[EFALWSCGB]\d{3,6}\b/i.test(question) ||
    /\bALM-?\d+\b/i.test(question)
  );
}

/**
 * 정확 키워드 재순위: 질문에 포함된 숫자(알람 번호 등)가
 * 청크 텍스트에 독립 단어로 등장하면 점수를 올려 상위로 끌어올림
 */
function exactMatchRerank(
  results: SearchResult[],
  question: string
): SearchResult[] {
  // 숫자 코드 (13, 001 등) + 알파벳 코드 (E.OV2, E.OC1, AL-16 등)
  const numbers = (question.match(/\b\d{1,6}\b/g) ?? []);
  const alphaCodes = (question.match(/\b[A-Z]{1,4}[.\-][A-Z0-9]{1,8}\b/gi) ?? []);
  const allTerms = [...numbers, ...alphaCodes];
  if (allTerms.length === 0) return results;

  return [...results]
    .map((r) => {
      let bonus = 0;
      for (const term of numbers) {
        if (new RegExp(`(?:^|\\D)${term}(?:\\D|$)`).test(r.chunk.text)) {
          bonus += 0.25;
        }
      }
      for (const code of alphaCodes) {
        // 알파벳 코드는 대소문자 무관 exact match
        const escaped = code.replace(/[.]/g, "\\.");
        if (new RegExp(escaped, "i").test(r.chunk.text)) {
          bonus += 0.5; // 코드 exact match는 더 높은 보너스
        }
      }
      return { ...r, score: r.score + bonus };
    })
    .sort((a, b) => b.score - a.score);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const { ip, userAgent } = extractRequestMeta(req);
  void cleanOldQueryLogs();

  // 요청 파싱 (빠름 — 스트림 밖에서 처리)
  let question: string, filterFilename: string | undefined, conversationHistory: HistoryMessage[], sessionId: string | undefined;
  try {
    const body = await req.json();
    question = body.question;
    filterFilename = body.filterFilename;
    conversationHistory = body.conversationHistory;
    sessionId = body.sessionId;
  } catch {
    return new Response(
      JSON.stringify({ error: "요청 본문을 파싱할 수 없습니다." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "질문을 입력해주세요." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const resolvedSessionId: string =
    typeof sessionId === "string" && sessionId ? sessionId : "anonymous";
  const history: HistoryMessage[] = Array.isArray(conversationHistory)
    ? conversationHistory
    : [];

  const encoder = new TextEncoder();

  // ── 스트림을 즉시 생성+반환하고, 무거운 작업(임베딩·GPT)은 스트림 내부에서 실행 ──
  // → 클라이언트가 응답 헤더를 즉시 받고, "thinking" 이벤트로 15초 타임아웃 해제
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let serverAccumulated = "";
      let finalToolUsed = false;
      let finalToolNames: string[] = [];
      let results: SearchResult[] = [];
      let topChunks: Array<{ filename: string; page: number; score: number }> = [];
      let sources: SourceReference[] = [];

      try {
        // 즉시 전송 → 클라이언트 타임아웃 타이머 해제
        send({ type: "thinking" });

        // 1) 벡터 검색 (임베딩 포함 — 첫 로드 시 느림)
        const alarmQuery = detectAlarmQuery(question.trim());
        const searchK = alarmQuery ? 20 : 12;
        // 벡터 검색은 현재 질문만 사용 — 대화 이력을 섞으면 임베딩이 오염되어 같은 질문도 결과가 달라짐
        const searchQuery = enhanceQueryForSearch(question.trim());
        const queryEmbedding = await embedText(searchQuery);
        const rawResults = searchVectorStore(
          queryEmbedding,
          { k: searchK, filterFilename: filterFilename || undefined },
          searchQuery
        );

        // 2) 임계값 필터링 + 재순위
        const scores = rawResults.map((r) => r.score);
        const threshold = alarmQuery ? 0.15 : computeDynamicThreshold(scores);
        const filtered = rawResults.filter((r) => r.score >= threshold);
        const reranked = alarmQuery ? exactMatchRerank(filtered, question.trim()) : filtered;
        const expandTopN = alarmQuery ? 5 : 3;
        const expandWindow = alarmQuery ? 2 : 1;
        results = expandWithNeighbors(reranked, expandTopN, expandWindow);

        topChunks = results.slice(0, 3).map((r) => ({
          filename: r.chunk.metadata.filename,
          page: r.chunk.metadata.page,
          score: r.score,
        }));

        // 3) 프롬프트 구성
        const { contextPrompt, sources: retrievedSources } = buildContextPromptFromResults(results);
        sources = retrievedSources;
        const systemPrompt = buildSystemPrompt();

        // 4) LangChain 에이전트 스트리밍
        const agentStream = runLangChainAgent({
          systemPrompt,
          contextPrompt,
          historyMessages: history.slice(-6),
          userMessage: question.trim(),
        });

        for await (const event of agentStream) {
          if (event.type === "tool_start") {
            send({ type: "tool_start", toolName: event.toolName, toolInput: event.toolInput });
          } else if (event.type === "tool_end") {
            send({ type: "tool_end", toolName: event.toolName, result: event.result });
          } else if (event.type === "delta") {
            serverAccumulated += event.content;
            send({ type: "delta", content: event.content });
          } else if (event.type === "done") {
            finalToolUsed = event.toolUsed ?? false;
            finalToolNames = ((event.toolLogs ?? []) as Array<{ toolName?: string }>)
              .map((log) => log.toolName ?? "")
              .filter(Boolean);

            appendQueryLog({
              timestamp: new Date().toISOString(),
              sessionId: resolvedSessionId,
              ip,
              userAgent,
              question: question.trim(),
              filterFilename: filterFilename ?? null,
              retrievedChunkCount: results.length,
              topChunks,
              responseLength: serverAccumulated.length,
              toolUsed: finalToolUsed,
              toolNames: finalToolNames,
              durationMs: Date.now() - startTime,
              error: null,
            });

            send({ type: "done", sources, toolUsed: event.toolUsed, toolLogs: event.toolLogs });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "스트리밍 오류";
        appendQueryLog({
          timestamp: new Date().toISOString(),
          sessionId: resolvedSessionId,
          ip,
          userAgent,
          question: question.trim(),
          filterFilename: filterFilename ?? null,
          retrievedChunkCount: results.length,
          topChunks,
          responseLength: serverAccumulated.length,
          toolUsed: finalToolUsed,
          toolNames: finalToolNames,
          durationMs: Date.now() - startTime,
          error: message,
        });
        send({ type: "error", message });
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
