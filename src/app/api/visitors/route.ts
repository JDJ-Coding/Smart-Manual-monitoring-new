import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "visitors.json");

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readData(): Promise<Record<string, number>> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeData(data: Record<string, number>): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const data = await readData();
  const date = today();
  return NextResponse.json({ date, count: data[date] ?? 0 });
}

export async function POST() {
  const data = await readData();
  const date = today();
  data[date] = (data[date] ?? 0) + 1;
  await writeData(data);
  return NextResponse.json({ date, count: data[date] });
}
