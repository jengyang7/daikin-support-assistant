import "server-only";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase/server";
import { embedTexts } from "@/lib/gemini";
import { parsePdf } from "./pdf";
import { chunkPages } from "./chunk";
import type { DocType, DocumentRow, Product } from "@/types";

export interface IngestInput {
  filename: string;
  title: string;
  product: Product | null;
  docType: DocType | null;
  description?: string | null;
  fileBytes: ArrayBuffer;
  contentType?: string;
}

export interface IngestResult {
  document: DocumentRow;
  chunkCount: number;
}

/**
 * Full ingestion pipeline for one PDF:
 *   1. Upload to Supabase Storage
 *   2. Parse pages with unpdf
 *   3. Chunk per page
 *   4. Embed all chunks via Gemini
 *   5. Insert documents row + document_chunks rows
 *
 * On any post-upload failure the storage object is rolled back.
 */
export async function ingestPdf(input: IngestInput): Promise<IngestResult> {
  const supa = getSupabaseAdmin();
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const storagePath = `${Date.now()}-${safeName}`;

  // 1. Upload to storage.
  const { error: uploadErr } = await supa.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.fileBytes, {
      contentType: input.contentType ?? "application/pdf",
      upsert: false,
    });
  if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

  try {
    // 2. Parse PDF.
    const { pageCount, pages } = await parsePdf(input.fileBytes);

    // 3. Chunk.
    const chunks = chunkPages(pages, {
      title: input.title,
      product: input.product,
      docType: input.docType,
    });
    if (chunks.length === 0) {
      throw new Error("PDF produced 0 chunks (is it scanned / image-only?)");
    }

    // 4. Embed.
    const embeddings = await embedTexts(chunks.map((c) => c.content));

    // 5a. Insert document row.
    const { data: doc, error: docErr } = await supa
      .from("documents")
      .insert({
        title: input.title,
        filename: input.filename,
        storage_path: storagePath,
        product: input.product,
        doc_type: input.docType,
        description: input.description ?? null,
        page_count: pageCount,
        file_size_bytes: input.fileBytes.byteLength,
      })
      .select("*")
      .single();
    if (docErr || !doc) {
      throw new Error(`Insert document failed: ${docErr?.message}`);
    }

    // 5b. Insert chunk rows in batches (Postgres parameter limit safety).
    const rows = chunks.map((c, idx) => ({
      document_id: doc.id,
      chunk_index: idx,
      page_number: c.pageNumber,
      content: c.content,
      embedding: embeddings[idx] as unknown as string, // pgvector accepts JSON arrays
    }));

    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error: chunkErr } = await supa.from("document_chunks").insert(batch);
      if (chunkErr) {
        // best-effort cleanup of the parent document so retries are clean
        await supa.from("documents").delete().eq("id", doc.id);
        throw new Error(`Insert chunks failed: ${chunkErr.message}`);
      }
    }

    return { document: doc as DocumentRow, chunkCount: chunks.length };
  } catch (err) {
    // Roll back storage upload.
    await supa.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {});
    throw err;
  }
}
