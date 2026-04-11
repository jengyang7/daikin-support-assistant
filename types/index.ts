// Shared types used by both server and client.

export type Product = "reiri_home" | "reiri_office" | "reiri_hotel" | "reiri_resort" | "reiri_all";

export type DocType = "catalogue" | "datasheet" | "installation" | "user_manual";

export interface DocumentRow {
  id: string;
  title: string;
  filename: string;
  storage_path: string;
  product: Product | null;
  doc_type: DocType | null;
  description: string | null;
  page_count: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface RetrievedChunk {
  chunk_id: number;
  document_id: string;
  title: string;
  filename: string;
  page_number: number;
  content: string;
  similarity: number;
  vector_rank: number | null;
  keyword_rank: number | null;
  rrf_score: number;
}

export interface Citation {
  index: number; // 1-based, matches [^n] in answer text
  document_id: string;
  title: string;
  page_number: number;
  content: string;
  similarity: number;
  rrf_score: number;
  vector_rank: number | null;
  keyword_rank: number | null;
}

export type Role = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
  debug?: {
    systemInstruction: string;
    userPrompt: string;
    chunks: RetrievedChunk[];
  };
  /** Base64 data URLs attached by the user (max 3, persisted in localStorage) */
  images?: string[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  productFilter: Product[];
  createdAt: number;
  updatedAt: number;
}

export const PRODUCT_LABELS: Record<Product, string> = {
  reiri_home: "Reiri Home",
  reiri_office: "Reiri Office",
  reiri_hotel: "Reiri Hotel",
  reiri_resort: "Reiri Resort",
  reiri_all: "All Reiri Products",
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  catalogue: "Catalogue",
  datasheet: "Datasheet",
  installation: "Installation",
  user_manual: "User Manual",
};
