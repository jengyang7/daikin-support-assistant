// Shared types used by both server and client.

export type Product = "reiri_home" | "reiri_office" | "reiri_hotel";

export type DocType = "manual" | "guide" | "technical" | "reference";

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
}

export interface Citation {
  index: number; // 1-based, matches [^n] in answer text
  document_id: string;
  title: string;
  page_number: number;
}

export type Role = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  productFilter: Product | null;
  createdAt: number;
  updatedAt: number;
}

export const PRODUCT_LABELS: Record<Product, string> = {
  reiri_home: "Reiri Home",
  reiri_office: "Reiri Office",
  reiri_hotel: "Reiri Hotel",
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  manual: "Manual",
  guide: "Guide",
  technical: "Technical",
  reference: "Reference",
};
