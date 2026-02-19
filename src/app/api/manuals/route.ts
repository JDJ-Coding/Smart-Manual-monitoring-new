import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getManualsDir, listPdfFiles } from "@/lib/pdfParser";
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

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const manualsDir = getManualsDir();
  fs.mkdirSync(manualsDir, { recursive: true });

  const uploaded: string[] = [];

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".pdf")) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(manualsDir, file.name), buffer);
    uploaded.push(file.name);
  }

  return NextResponse.json({
    success: true,
    uploaded,
    message: `${uploaded.length}개 파일 업로드 완료`,
  });
}
