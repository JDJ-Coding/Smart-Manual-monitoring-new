import { NextRequest, NextResponse } from "next/server";
import { embedText } from "@/lib/embeddings";
import { searchVectorStore } from "@/lib/vectorStore";
import { callPoscoGpt } from "@/lib/poscoGpt";

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

export async function POST(req: NextRequest) {
  try {
    const { question, filterFilename, conversationHistory } = await req.json();

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
    }

    const history: HistoryMessage[] = Array.isArray(conversationHistory)
      ? conversationHistory
      : [];

    // Build a richer search query using conversation context
    const searchQuery = buildContextualQuery(question.trim(), history);
    const queryEmbedding = await embedText(searchQuery);

    const results = searchVectorStore(queryEmbedding, {
      k: 10,
      filterFilename: filterFilename || undefined,
    });

    if (results.length === 0) {
      return NextResponse.json({
        answer:
          "관련 매뉴얼 내용을 찾지 못했습니다. 다른 키워드로 시도하거나 검색 범위를 변경해보세요.",
        sources: [],
      });
    }

    const { answer, sources } = await callPoscoGpt(
      question.trim(),
      results,
      history
    );

    return NextResponse.json({ answer, sources });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
