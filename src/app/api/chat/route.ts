import { NextRequest, NextResponse } from "next/server";
import { embedText } from "@/lib/embeddings";
import { searchVectorStore } from "@/lib/vectorStore";
import { callPoscoGpt } from "@/lib/poscoGpt";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { question, filterFilename } = await req.json();

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
    }

    const queryEmbedding = await embedText(question.trim());

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

    const { answer, sources } = await callPoscoGpt(question.trim(), results);

    return NextResponse.json({ answer, sources });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
