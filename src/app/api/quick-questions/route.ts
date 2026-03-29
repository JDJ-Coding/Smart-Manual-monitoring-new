import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import fs from "fs";
import path from "path";
import type { QuickQuestion } from "@/types";

const QQ_FILE = path.join(process.cwd(), "data", "quick-questions.json");

const DEFAULT_QUESTIONS: QuickQuestion[] = [
  { id: "1", text: "알람 코드 원인과 조치 방법", tag: "알람 코드", icon: "Zap" },
  { id: "2", text: "고장 발생 시 조치 절차", tag: "고장 조치", icon: "Wrench" },
  { id: "3", text: "파라미터 초기화 절차", tag: "설정 초기화", icon: "RefreshCw" },
  { id: "4", text: "과전류 보호 기능 설명", tag: "보호 기능", icon: "AlertTriangle" },
  { id: "5", text: "과열 알람 원인과 해결 방법", tag: "온도 관련", icon: "Thermometer" },
  { id: "6", text: "예방 점검 주기 및 항목", tag: "점검 절차", icon: "FileText" },
];

function loadQuestions(): QuickQuestion[] {
  if (!fs.existsSync(QQ_FILE)) return DEFAULT_QUESTIONS;
  try {
    return JSON.parse(fs.readFileSync(QQ_FILE, "utf-8"));
  } catch {
    return DEFAULT_QUESTIONS;
  }
}

export async function GET() {
  return NextResponse.json({ questions: loadQuestions() });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { questions } = await req.json();
    if (!Array.isArray(questions)) {
      return NextResponse.json({ error: "잘못된 형식입니다." }, { status: 400 });
    }

    // 최대 8개 제한
    const validated: QuickQuestion[] = questions.slice(0, 8).map((q: any) => ({
      id: String(q.id ?? crypto.randomUUID()),
      text: String(q.text ?? "").trim().slice(0, 100),
      tag: String(q.tag ?? "").trim().slice(0, 20),
      icon: String(q.icon ?? "FileText"),
    })).filter((q) => q.text.length > 0);

    const dir = path.dirname(QQ_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(QQ_FILE, JSON.stringify(validated, null, 2), "utf-8");

    return NextResponse.json({ success: true, questions: validated });
  } catch {
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
