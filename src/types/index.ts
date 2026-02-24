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
}

export interface SourceReference {
  filename: string;
  page: number;
  excerpt: string;
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
