import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { embedQuery } from "@/lib/gemini";
import type { DocType, Product, RetrievedChunk } from "@/types";

export interface RetrieveOptions {
  query: string;
  matchCount?: number;
  product?: Product | null;
  docType?: DocType | null;
}

/**
 * Embed `query` and call the match_chunks RPC, returning the most similar
 * chunks (optionally filtered by product / doc_type).
 */
export async function retrieve(opts: RetrieveOptions): Promise<RetrievedChunk[]> {
  const supa = getSupabaseAdmin();
  const queryEmbedding = await embedQuery(opts.query);

  const { data, error } = await supa.rpc("match_chunks", {
    query_embedding: queryEmbedding as unknown as string,
    match_count: opts.matchCount ?? 6,
    filter_product: opts.product ?? null,
    filter_doc_type: opts.docType ?? null,
  });

  if (error) throw new Error(`match_chunks failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}
