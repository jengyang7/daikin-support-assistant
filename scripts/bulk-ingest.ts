/**
 * Bulk ingest script — reads all PDFs from Daikin Docs/ subfolders and
 * uploads them directly to Supabase (storage + embeddings + DB rows).
 *
 * Usage:
 *   npx tsx scripts/bulk-ingest.ts
 *   npx tsx scripts/bulk-ingest.ts --dry-run   # list files only, no upload
 *
 * Reads credentials from .env.local automatically.
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { getDocumentProxy, extractText } from "unpdf";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = path.resolve(process.cwd(), "Daikin Docs");
const DRY_RUN = process.argv.includes("--dry-run");

// Folder name → DocType value stored in DB
const FOLDER_TO_DOC_TYPE: Record<string, string> = {
  "Catalogue": "catalogue",
  "Datasheet": "datasheet",
  "installation manuals": "installation",
  "user manual": "user_manual",
};

// Filename substring → Product value
const PRODUCT_PATTERNS: Array<{ pattern: RegExp; product: string }> = [
  { pattern: /reiri for office/i, product: "reiri_office" },
  { pattern: /reiri for home/i,   product: "reiri_home" },
  { pattern: /reiri for hotel/i,  product: "reiri_hotel" },
];

// Chunker settings (must match lib/rag/chunk.ts)
const TARGET_CHARS = 800 * 4;  // ~3200
const OVERLAP_CHARS = 100 * 4; // ~400
const BATCH = 100; // Gemini embedding batch size

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectProduct(filename: string): string | null {
  for (const { pattern, product } of PRODUCT_PATTERNS) {
    if (pattern.test(filename)) return product;
  }
  return null;
}

function buildPrefix(title: string, product: string | null, docType: string | null, pageNumber: number): string {
  const tags: string[] = [];
  const productLabels: Record<string, string> = { reiri_home: "Reiri Home", reiri_office: "Reiri Office", reiri_hotel: "Reiri Hotel" };
  const typeLabels: Record<string, string> = { catalogue: "Catalogue", datasheet: "Datasheet", installation: "Installation Manual", user_manual: "User Manual" };
  if (product) tags.push(productLabels[product] ?? product);
  if (docType) tags.push(typeLabels[docType] ?? docType);
  tags.push(`Page ${pageNumber}`);
  return `[Document: ${title}]\n[${tags.join(" · ")}]\n\n`;
}

function chunkText(text: string, target: number, overlap: number): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + target, text.length);
    let cut = end;
    if (end < text.length) {
      const window = text.slice(i, end);
      const minOff = Math.floor(window.length * 0.7);
      for (const re of [/\n\n/g, /\.\s/g, /[\s]/g]) {
        let last = -1;
        let m: RegExpExecArray | null;
        while ((m = re.exec(window)) !== null) {
          if (m.index >= minOff) last = m.index + m[0].length;
        }
        if (last > 0) { cut = i + last; break; }
      }
    }
    const slice = text.slice(i, cut).trim();
    if (slice.length > 0) result.push(slice);
    if (cut >= text.length) break;
    i = Math.max(cut - overlap, i + 1);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const googleKey   = process.env.GOOGLE_API_KEY!;

  if (!supabaseUrl || !serviceKey || !googleKey) {
    throw new Error("Missing env vars — check .env.local");
  }

  const supa = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ai = new GoogleGenAI({ apiKey: googleKey });

  // Collect all PDFs to process
  const jobs: Array<{ filePath: string; docType: string; filename: string }> = [];
  for (const [folder, docType] of Object.entries(FOLDER_TO_DOC_TYPE)) {
    const dir = path.join(ROOT, folder);
    if (!fs.existsSync(dir)) { console.warn(`⚠ Folder not found: ${dir}`); continue; }
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith(".pdf")) continue;
      jobs.push({ filePath: path.join(dir, f), docType, filename: f });
    }
  }

  console.log(`\nFound ${jobs.length} PDFs to ingest${DRY_RUN ? " (dry run)" : ""}:\n`);
  for (const j of jobs) console.log(`  [${j.docType}] ${j.filename}`);
  if (DRY_RUN) { console.log("\nDry run complete."); return; }

  let success = 0, failed = 0;
  for (const { filePath, docType, filename } of jobs) {
    const title = filename.replace(/\.pdf$/i, "");
    const product = detectProduct(filename);
    console.log(`\n▶ ${filename}`);
    console.log(`  product=${product ?? "none"}  type=${docType}`);

    try {
      const nodeBuf = fs.readFileSync(filePath);
      const fileBytes: ArrayBuffer = nodeBuf.buffer.slice(
        nodeBuf.byteOffset,
        nodeBuf.byteOffset + nodeBuf.byteLength,
      ) as ArrayBuffer;

      // Parse PDF
      const pdf = await getDocumentProxy(new Uint8Array(fileBytes));
      const pageCount = pdf.numPages;
      const { text: allPageTexts } = await extractText(pdf, { mergePages: false });
      const pageTexts = Array.isArray(allPageTexts) ? allPageTexts : [allPageTexts];
      const pages: Array<{ pageNumber: number; text: string }> = [];
      for (let p = 0; p < pageTexts.length; p++) {
        const pageText = pageTexts[p] ?? "";
        if (pageText && pageText.length >= 40) pages.push({ pageNumber: p + 1, text: pageText });
      }

      // Chunk with metadata prefix
      const chunks: Array<{ pageNumber: number; content: string }> = [];
      for (const page of pages) {
        const prefix = buildPrefix(title, product, docType, page.pageNumber);
        const effectiveTarget = Math.max(TARGET_CHARS - prefix.length, 800);
        if (page.text.length <= effectiveTarget) {
          chunks.push({ pageNumber: page.pageNumber, content: prefix + page.text });
        } else {
          for (const part of chunkText(page.text, effectiveTarget, OVERLAP_CHARS)) {
            chunks.push({ pageNumber: page.pageNumber, content: prefix + part });
          }
        }
      }
      if (chunks.length === 0) throw new Error("PDF produced 0 chunks (scanned/image?)");
      console.log(`  parsed ${pageCount} pages → ${chunks.length} chunks`);

      // Upload to storage
      const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const storagePath = `${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supa.storage
        .from("documents")
        .upload(storagePath, nodeBuf, { contentType: "application/pdf", upsert: false });
      if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);
      console.log(`  uploaded to storage`);

      try {
        // Embed all chunks
        const embeddings: number[][] = [];
        for (let i = 0; i < chunks.length; i += BATCH) {
          const slice = chunks.slice(i, i + BATCH);
          const res = await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: slice.map((c) => ({ role: "user", parts: [{ text: c.content }] })),
            config: { outputDimensionality: 768 },
          });
          for (const e of res.embeddings ?? []) {
            if (!e.values) throw new Error("Missing embedding values");
            embeddings.push(e.values);
          }
        }
        console.log(`  embedded ${embeddings.length} chunks`);

        // Insert document row
        const { data: doc, error: docErr } = await supa
          .from("documents")
          .insert({
            title,
            filename,
            storage_path: storagePath,
            product,
            doc_type: docType,
            page_count: pageCount,
            file_size_bytes: nodeBuf.length,
          })
          .select("*")
          .single();
        if (docErr || !doc) throw new Error(`Insert document failed: ${docErr?.message}`);

        // Insert chunk rows in batches
        const rows = chunks.map((c, idx) => ({
          document_id: doc.id,
          chunk_index: idx,
          page_number: c.pageNumber,
          content: c.content,
          embedding: embeddings[idx],
        }));
        for (let i = 0; i < rows.length; i += 200) {
          const { error: chunkErr } = await supa.from("document_chunks").insert(rows.slice(i, i + 200));
          if (chunkErr) {
            await supa.from("documents").delete().eq("id", doc.id);
            throw new Error(`Insert chunks failed: ${chunkErr.message}`);
          }
        }

        console.log(`  ✓ saved to database (doc id: ${doc.id})`);
        success++;
      } catch (err) {
        await supa.storage.from("documents").remove([storagePath]).catch(() => {});
        throw err;
      }
    } catch (err) {
      console.error(`  ✗ FAILED: ${err}`);
      failed++;
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Done: ${success} succeeded, ${failed} failed`);
}

main().catch((err) => { console.error(err); process.exit(1); });
