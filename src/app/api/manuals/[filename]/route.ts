import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getManualsDir } from "@/lib/pdfParser";
import { appendAdminLog, extractRequestMeta } from "@/lib/adminLogger";
import fs from "fs";
import path from "path";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { ip, userAgent } = extractRequestMeta(req);

  // Sanitize: prevent path traversal attacks
  const filename = path.basename(decodeURIComponent(params.filename));
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "잘못된 파일명입니다." }, { status: 400 });
  }

  const filePath = path.join(getManualsDir(), filename);
  if (!fs.existsSync(filePath)) {
    appendAdminLog({
      timestamp: new Date().toISOString(),
      action: "PDF_DELETE",
      detail: `삭제 실패: ${filename} (파일 없음)`,
      ip,
      userAgent,
      success: false,
      error: "파일을 찾을 수 없습니다.",
    });
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  fs.unlinkSync(filePath);

  appendAdminLog({
    timestamp: new Date().toISOString(),
    action: "PDF_DELETE",
    detail: `삭제: ${filename}`,
    ip,
    userAgent,
    success: true,
    error: null,
  });

  return NextResponse.json({ success: true, message: `${filename} 삭제 완료` });
}
