export interface TextChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    filename: string;
    page: number;
    chunkIndex: number;
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
