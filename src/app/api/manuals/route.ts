import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getManualsDir, listPdfFiles } from "@/lib/pdfParser";
import { appendAdminLog, extractRequestMeta } from "@/lib/adminLogger";
import fs from "fs";
import path from "path";
import { stat } from "fs/promises";

export async function GET() {
  const files = listPdfFiles();
  const manualsDir = getManualsDir();

  const fileInfos = await Promise.all(
    files.map(async (filename) => {
      const stats = await stat(path.join(manualsDir, filename));
      return {
        filename,
        sizeBytes: stats.size,
        uploadedAt: stats.mtime.toISOString(),
      };
    })
  );

  return NextResponse.json({ files: fileInfos });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { ip, userAgent } = extractRequestMeta(req);

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    appendAdminLog({
      timestamp: new Date().toISOString(),
      action: "PDF_UPLOAD",
      detail: "파일 없음",
      ip,
      userAgent,
      success: false,
      error: "파일이 없습니다.",
    });
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const manualsDir = getManualsDir();
  fs.mkdirSync(manualsDir, { recursive: true });

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
  const uploaded: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    // path traversal 방지: 파일명만 추출
    const safeName = path.basename(file.name);
    if (!safeName || !safeName.toLowerCase().endsWith(".pdf")) continue;
    // 파일 크기 제한 (50 MB)
    if (file.size > MAX_FILE_SIZE) {
      skipped.push(`${safeName} (50 MB 초과)`);
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(manualsDir, safeName), buffer);
    uploaded.push(safeName);
  }

  if (skipped.length > 0 && uploaded.length === 0) {
    const errorMsg = `파일 크기 초과로 업로드 실패: ${skipped.join(", ")}`;
    appendAdminLog({
      timestamp: new Date().toISOString(),
      action: "PDF_UPLOAD",
      detail: errorMsg,
      ip,
      userAgent,
      success: false,
      error: errorMsg,
    });
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  appendAdminLog({
    timestamp: new Date().toISOString(),
    action: "PDF_UPLOAD",
    detail: `업로드 완료: ${uploaded.join(", ")}`,
    ip,
    userAgent,
    success: true,
    error: null,
  });

  return NextResponse.json({
    success: true,
    uploaded,
    skipped,
    message: `${uploaded.length}개 파일 업로드 완료${skipped.length > 0 ? `, ${skipped.length}개 건너뜀` : ""}`,
  });
}
