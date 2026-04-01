import { NextResponse } from "next/server";
import { loadVectorStore } from "@/lib/vectorStore";

export async function GET() {
  const store = loadVectorStore();
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    dbBuilt: store !== null,
    totalChunks: store?.totalChunks ?? 0,
  });
}
