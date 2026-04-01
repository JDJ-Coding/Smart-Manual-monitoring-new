import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "alarm-codes.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ codes: [] });
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    return NextResponse.json({ codes: Object.keys(data) });
  } catch {
    return NextResponse.json({ codes: [] });
  }
}
