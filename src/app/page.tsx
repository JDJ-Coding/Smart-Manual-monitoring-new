"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default function HomePage() {
  const [manualFiles, setManualFiles] = useState<string[]>([]);
  const [dbBuilt, setDbBuilt] = useState(false);
  const [selectedManual, setSelectedManual] = useState("전체 매뉴얼 검색");

  useEffect(() => {
    fetch("/api/manuals")
      .then((r) => r.json())
      .then((data) => {
        const files = (data.files ?? []).map((f: { filename: string }) => f.filename);
        setManualFiles(files);
      })
      .catch(() => {});

    fetch("/api/db-status")
      .then((r) => r.json())
      .then((data) => setDbBuilt(data.built ?? false))
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar
        manualFiles={manualFiles}
        dbBuilt={dbBuilt}
        selectedManual={selectedManual}
        onManualChange={setSelectedManual}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatContainer
          manualFiles={manualFiles}
          dbBuilt={dbBuilt}
          selectedManual={selectedManual}
        />
      </main>
    </div>
  );
}
