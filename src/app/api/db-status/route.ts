import { NextResponse } from "next/server";
import { loadVectorStore } from "@/lib/vectorStore";

export async function GET() {
  const store = loadVectorStore();
  return NextResponse.json({
    built: store !== null,
    totalChunks: store?.totalChunks ?? 0,
    builtAt: store?.builtAt ?? null,
  });
}
