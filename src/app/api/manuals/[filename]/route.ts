import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getManualsDir } from "@/lib/pdfParser";
import fs from "fs";
import path from "path";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  // Sanitize: prevent path traversal attacks
  const filename = path.basename(decodeURIComponent(params.filename));
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "잘못된 파일명입니다." }, { status: 400 });
  }

  const filePath = path.join(getManualsDir(), filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  fs.unlinkSync(filePath);
  return NextResponse.json({ success: true, message: `${filename} 삭제 완료` });
}
