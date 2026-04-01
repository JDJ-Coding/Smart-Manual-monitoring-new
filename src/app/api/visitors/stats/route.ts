import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "visitors.json");

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const visitors = JSON.parse(raw) as Record<string, number>;
    return NextResponse.json({ visitors });
  } catch {
    return NextResponse.json({ visitors: {} });
  }
}
