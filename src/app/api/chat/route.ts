import { NextRequest, NextResponse } from "next/server";
import { embedText } from "@/lib/embeddings";
import { searchVectorStore } from "@/lib/vectorStore";
import { runChatAgent } from "@/lib/agent";
import type { SourceReference } from "@/types";

export const maxDuration = 60;

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Builds a context-aware search query by prepending recent user messages.
 * This helps resolve follow-up questions like "가격은?" → "A에 대한 가격은?"
 */
function buildContextualQuery(
  question: string,
  history: HistoryMessage[]
): string {
  if (!history || history.length === 0) return question;

  // Gather the last 2 user messages to give vector search extra context
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
    chunk: {
      text: string;
      metadata: { filename: string; page: number };
    };
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
      });
    }

    return `[${idx + 1}] 파일: ${filename} | p.${page} | score: ${r.score.toFixed(3)}
${r.chunk.text}`;
  });

  return {
    contextPrompt: `다음은 매뉴얼 검색 결과입니다. 답변 시 우선 참고하세요.

${contextParts.join("\n\n---\n\n")}`,
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

export async function POST(req: NextRequest) {
  try {
    const { question, filterFilename, conversationHistory } = await req.json();

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
    }

    const history: HistoryMessage[] = Array.isArray(conversationHistory)
      ? conversationHistory
      : [];

    // 1) Build richer query with recent conversation context
    const searchQuery = buildContextualQuery(question.trim(), history);
    const queryEmbedding = await embedText(searchQuery);

    // 2) Vector search (기존 시그니처 유지)
    const rawResults = searchVectorStore(queryEmbedding, {
      k: 10,
      filterFilename: filterFilename || undefined,
    });

    // 3) Relevance threshold
    const MIN_SCORE = 0.3;
    const results = rawResults.filter((r) => r.score >= MIN_SCORE);

    // 4) Build prompts for Agent
    const { contextPrompt, sources } = buildContextPromptFromResults(results);
    const systemPrompt = buildSystemPrompt();

    // 5) Run Agent (tool call + second-pass reasoning)
    const agentResult = await runChatAgent({
      systemPrompt,
      contextPrompt,
      historyMessages: history.slice(-6), // 기존 정책(최근 6개) 유지
      userMessage: question.trim(),
    });

    // 6) Response
    return NextResponse.json({
      answer: agentResult.answer,
      sources,
      toolUsed: agentResult.toolUsed,
      toolLogs: agentResult.toolLogs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
