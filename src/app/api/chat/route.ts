import { NextRequest } from "next/server";
import { embedText } from "@/lib/embeddings";
import { searchVectorStore, expandWithNeighbors } from "@/lib/vectorStore";
import { runChatAgent } from "@/lib/agent";
import { callPoscoGptStream } from "@/lib/poscoGpt";
import type { SourceReference } from "@/types";

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
    contextPrompt: `[매뉴얼 검색 결과] 아래 내용을 우선 참고하여 답변하세요. 참고 번호([참고N])를 인용할 수 있습니다.\n\n${contextParts.join("\n\n---\n\n")}`,
    sources,
  };
}

function buildSystemPrompt(): string {
  return `당신은 스마트 매뉴얼 도우미입니다. 산업 설비 유지보수 분야의 전문 지식을 보유하고 있습니다.

답변 원칙:
- [매뉴얼 내용]이 제공되고 질문과 관련이 있으면, 해당 내용을 우선 활용하여 정확하게 답변하세요.
- [매뉴얼 내용]이 질문과 관련이 없거나 제공되지 않은 경우, 보유한 전문 지식으로 성실히 답변하세요.
- 알람 코드·고장 증상 질문에는 알람 의미·원인·조치 방법을 구체적으로 설명하세요.
- 일반적인 질문(사양, 절차, 개념, 기타)에는 질문 유형에 맞게 자연스럽게 답변하세요.
- 매뉴얼에 없는 내용을 창작하거나 추측하지 마세요.
- 모든 답변은 한국어로 작성하세요.`;
}

/** 동적 스코어 임계값 계산 */
function computeDynamicThreshold(scores: number[]): number {
  if (scores.length === 0) return 0.3;
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const stddev = Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length);
  // 최상위 점수가 0.7 이상이면 노이즈 제거를 강화
  const topScore = sorted[sorted.length - 1];
  if (topScore >= 0.7) return Math.max(0.4, median - stddev);
  return Math.max(0.25, median - 1.5 * stddev);
}

export async function POST(req: NextRequest) {
  try {
    const { question, filterFilename, conversationHistory } = await req.json();

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "질문을 입력해주세요." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const history: HistoryMessage[] = Array.isArray(conversationHistory)
      ? conversationHistory
      : [];

    // 1) 벡터 검색 (코사인 + BM25 하이브리드)
    const searchQuery = buildContextualQuery(question.trim(), history);
    const queryEmbedding = await embedText(searchQuery);
    const rawResults = searchVectorStore(
      queryEmbedding,
      { k: 12, filterFilename: filterFilename || undefined },
      searchQuery // BM25 키워드 검색용
    );

    // 2) 동적 임계값 필터링
    const scores = rawResults.map((r) => r.score);
    const threshold = computeDynamicThreshold(scores);
    const filtered = rawResults.filter((r) => r.score >= threshold);

    // 2-1) 상위 3개 결과 주변 ±1 청크 추가 (컨텍스트 풍부화)
    const results = expandWithNeighbors(filtered, 3, 1);

    // 3) 프롬프트 구성
    const { contextPrompt, sources } = buildContextPromptFromResults(results);
    const systemPrompt = buildSystemPrompt();

    // 4) 도구 필요 여부 먼저 확인 (non-streaming agent call)
    const agentResult = await runChatAgent({
      systemPrompt,
      contextPrompt,
      historyMessages: history.slice(-6),
      userMessage: question.trim(),
    });

    // 5) SSE 스트리밍 응답
    const encoder = new TextEncoder();
    const sourcesJson = JSON.stringify(sources);
    const toolLogsJson = JSON.stringify(agentResult.toolLogs);

    // If agent used tools, answer is already complete – stream it as single chunk
    const finalAnswer = agentResult.answer;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          if (agentResult.toolUsed || finalAnswer.length > 0) {
            // Stream character by character to simulate streaming when tools were used
            // or stream from the already-complete answer
            const chunkSize = 4;
            for (let i = 0; i < finalAnswer.length; i += chunkSize) {
              send({ type: "delta", content: finalAnswer.slice(i, i + chunkSize) });
            }
          } else {
            // True streaming from GPT API
            const messages = [
              { role: "system" as const, content: systemPrompt },
              ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
              {
                role: "user" as const,
                content: `아래 [매뉴얼 내용]을 참고하여 [질문]에 답변하세요.\n\n${contextPrompt}\n\n[질문]\n${question.trim()}`,
              },
            ];

            const gptStream = await callPoscoGptStream({ messages });
            const reader = gptStream.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              send({ type: "delta", content: value });
            }
          }
        } catch (streamErr) {
          // Fall back to already-computed answer on streaming error
          send({ type: "delta", content: finalAnswer });
        }

        // Done event with metadata
        send({
          type: "done",
          sources: JSON.parse(sourcesJson),
          toolUsed: agentResult.toolUsed,
          toolLogs: JSON.parse(toolLogsJson),
        });
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
