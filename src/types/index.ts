export interface TextChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    filename: string;
    page: number;
    chunkIndex: number;
    isTable?: boolean;
    isAlarmRelated?: boolean;
    extractedCodes?: string[];
    language?: "ko" | "en" | "mixed";
  };
}

export interface VectorStore {
  version: number;
  builtAt: string;
  totalChunks: number;
  chunks: TextChunk[];
}

export interface SearchResult {
  chunk: TextChunk;
  score: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SourceReference[];
  timestamp: string;
  feedbackGiven?: "positive" | "negative" | null;
  bookmarked?: boolean;
}

export interface SourceReference {
  filename: string;
  page: number;
  excerpt: string;
  fullText?: string;
}

export interface ManualFile {
  filename: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  selectedManual: string;
  createdAt: string;
  updatedAt: string;
}

export type ToolLog = {
  toolName: string;
  args: Record<string, any>;
  result: string;
}

export type PoscoToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ParseReport {
  filename: string;
  totalPages: number;
  totalChunks: number;
  avgChunkLength: number;
  hasWarning: boolean; // true if totalChunks === 0 (image-only PDF)
}

export interface FeedbackEntry {
  sessionId: string;
  messageIndex: number;
  rating: "positive" | "negative";
  reason?: string;
  timestamp: string;
}

export interface QuickQuestion {
  id: string;
  text: string;
  tag: string;
  icon: string; // icon name from lucide-react
}

export interface QueryLog {
  timestamp: string;
  sessionId: string;
  ip: string;
  userAgent: string;
  question: string;
  filterFilename: string | null;
  retrievedChunkCount: number;
  topChunks: Array<{
    filename: string;
    page: number;
    score: number;
  }>;
  responseLength: number;
  toolUsed: boolean;
  toolNames: string[];
  durationMs: number;
  error: string | null;
}

export type AdminAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAIL"
  | "LOGOUT"
  | "PDF_UPLOAD"
  | "PDF_DELETE"
  | "BUILD_DB_START"
  | "BUILD_DB_COMPLETE"
  | "BUILD_DB_FAIL";

export interface AdminLog {
  timestamp: string;
  action: AdminAction;
  detail: string;
  ip: string;
  userAgent: string;
  success: boolean;
  error: string | null;
}
