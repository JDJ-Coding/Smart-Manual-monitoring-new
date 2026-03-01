"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { QuickPanel } from "@/components/chat/QuickPanel";
import type { ChatSession, ChatMessage } from "@/types";

const SESSIONS_KEY = "smart-manual-sessions";
const MAX_SESSIONS = 30;

function generateId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
}

export default function HomePage() {
  const [manualFiles, setManualFiles] = useState<string[]>([]);
  const [dbBuilt, setDbBuilt] = useState(false);
  const [selectedManual, setSelectedManual] = useState("전체 매뉴얼 검색");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState("new");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSessions(loadSessions());

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

  // Keep ref in sync
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    setChatKey(generateId());
  }, []);

  const handleSessionSelect = useCallback((id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      setSelectedManual(session.selectedManual);
    }
    setCurrentSessionId(id);
    currentSessionIdRef.current = id;
    setChatKey(id);
  }, [sessions]);

  const handleSessionDelete = useCallback((id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      persistSessions(updated);
      return updated;
    });
    if (currentSessionIdRef.current === id) {
      setCurrentSessionId(null);
      currentSessionIdRef.current = null;
      setChatKey(generateId());
    }
  }, []);

  const handleSessionUpdate = useCallback((messages: ChatMessage[]) => {
    if (messages.length === 0) return;

    const rawTitle = messages[0].content;
    const title = rawTitle.length > 45 ? rawTitle.slice(0, 45) + "…" : rawTitle;
    const now = new Date().toISOString();
    const sessionId = currentSessionIdRef.current;

    if (!sessionId) {
      const newId = generateId();
      const newSession: ChatSession = {
        id: newId,
        title,
        messages,
        selectedManual,
        createdAt: now,
        updatedAt: now,
      };
      setSessions((prev) => {
        const updated = [newSession, ...prev];
        persistSessions(updated);
        return updated;
      });
      setCurrentSessionId(newId);
      currentSessionIdRef.current = newId;
    } else {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === sessionId
            ? { ...s, title, messages, selectedManual, updatedAt: now }
            : s
        );
        persistSessions(updated);
        return updated;
      });
    }
  }, [selectedManual]);

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden" role="application" aria-label="Smart Manual Assistant">
      <Sidebar
        manualFiles={manualFiles}
        dbBuilt={dbBuilt}
        selectedManual={selectedManual}
        onManualChange={setSelectedManual}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSessionSelect={handleSessionSelect}
        onSessionDelete={handleSessionDelete}
      />
      <main className="flex-1 flex min-w-0 overflow-hidden">
        <ChatContainer
          key={chatKey}
          dbBuilt={dbBuilt}
          selectedManual={selectedManual}
          initialMessages={currentSession?.messages ?? []}
          onSessionUpdate={handleSessionUpdate}
          pendingQuestion={pendingQuestion}
          onPendingQuestionConsumed={() => setPendingQuestion(null)}
        />
        <QuickPanel
          onQuickAsk={setPendingQuestion}
          messageCount={currentSession?.messages.length ?? 0}
          sourceCount={
            (currentSession?.messages ?? [])
              .flatMap((m) => m.sources ?? [])
              .filter((v, i, arr) =>
                arr.findIndex((s) => s.filename === v.filename && s.page === v.page) === i
              ).length
          }
          disabled={!dbBuilt}
        />
      </main>
    </div>
  );
}
