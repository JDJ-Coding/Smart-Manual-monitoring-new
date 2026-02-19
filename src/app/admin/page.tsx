import { redirect } from "next/navigation";
import { checkAdminFromCookies } from "@/lib/auth";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { listPdfFiles, getManualsDir } from "@/lib/pdfParser";
import { loadVectorStore } from "@/lib/vectorStore";
import { stat } from "fs/promises";
import path from "path";

export default async function AdminPage() {
  const isAdmin = await checkAdminFromCookies();
  if (!isAdmin) {
    redirect("/admin/login");
  }

  const files = listPdfFiles();
  const manualsDir = getManualsDir();
  const store = loadVectorStore();

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

  return (
    <AdminPanel
      files={fileInfos}
      dbBuilt={store !== null}
      totalChunks={store?.totalChunks ?? 0}
      dbBuiltAt={store?.builtAt ?? null}
    />
  );
}
