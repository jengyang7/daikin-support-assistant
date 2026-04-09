import type { PdfPage } from "./pdf";
import type { DocType, Product } from "@/types";

export interface Chunk {
  pageNumber: number;
  content: string;
}

export interface ChunkMeta {
  title: string;
  product: Product | null;
  docType: DocType | null;
}

// Rough heuristic: 1 token ≈ 4 characters of English text.
const CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = 800;
const OVERLAP_TOKENS = 100;

const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN; // ~3200
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN; // ~400

const PRODUCT_LABELS: Record<Product, string> = {
  reiri_home: "Reiri Home",
  reiri_office: "Reiri Office",
  reiri_hotel: "Reiri Hotel",
  reiri_resort: "Reiri Resort",
  reiri_all: "All Reiri Products",
};

const DOC_TYPE_LABELS: Record<DocType, string> = {
  catalogue: "Catalogue",
  datasheet: "Datasheet",
  installation: "Installation Manual",
  user_manual: "User Manual",
};

/**
 * Build the contextual prefix embedded at the top of every chunk.
 * This helps the vector model connect queries like "Reiri Hotel keycard wiring"
 * to chunks whose raw text never mentions the product name.
 */
function buildPrefix(meta: ChunkMeta, pageNumber: number): string {
  const tags: string[] = [];
  if (meta.product) tags.push(PRODUCT_LABELS[meta.product] ?? meta.product);
  if (meta.docType) tags.push(DOC_TYPE_LABELS[meta.docType] ?? meta.docType);
  tags.push(`Page ${pageNumber}`);
  return `[Document: ${meta.title}]\n[${tags.join(" · ")}]\n\n`;
}

/**
 * Page-aware recursive chunker.
 *
 * Each chunk stays within a single PDF page so the page citation we surface in
 * the chat UI is always accurate. Pages longer than ~3200 chars are split into
 * sliding windows with ~400-char overlap; short pages become a single chunk.
 *
 * Every chunk is prefixed with document/product/page metadata so that dense
 * embeddings capture the document context alongside the raw text.
 *
 * Splitting prefers semantic boundaries: blank lines first, then sentence ends,
 * then word boundaries, falling back to a hard character cut.
 */
export function chunkPages(pages: PdfPage[], meta: ChunkMeta): Chunk[] {
  const out: Chunk[] = [];
  for (const page of pages) {
    const text = page.text;
    if (!text || text.length < 40) continue; // skip empty / near-empty pages

    const prefix = buildPrefix(meta, page.pageNumber);
    // Reduce target size by prefix length so total chunk stays within budget.
    const effectiveTarget = Math.max(TARGET_CHARS - prefix.length, 800);

    if (text.length <= effectiveTarget) {
      out.push({ pageNumber: page.pageNumber, content: prefix + text });
      continue;
    }

    const parts = splitText(text, effectiveTarget, OVERLAP_CHARS);
    for (const p of parts) {
      out.push({ pageNumber: page.pageNumber, content: prefix + p });
    }
  }
  return out;
}

function splitText(text: string, target: number, overlap: number): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + target, text.length);
    let cut = end;

    if (end < text.length) {
      // Prefer to break at a paragraph, then sentence, then word boundary,
      // searching backwards from the target end.
      cut = findBoundary(text, i, end);
    }

    const slice = text.slice(i, cut).trim();
    if (slice.length > 0) result.push(slice);

    if (cut >= text.length) break;
    i = Math.max(cut - overlap, i + 1);
  }
  return result;
}

function findBoundary(text: string, start: number, end: number): number {
  const window = text.slice(start, end);
  // Search backwards in the last ~30% of the window for a clean break.
  const minBreakOffset = Math.floor(window.length * 0.7);
  const candidates: RegExp[] = [
    /\n\n/g, // paragraph
    /\.\s/g, // sentence end
    /[\s]/g, // any whitespace
  ];
  for (const re of candidates) {
    let last = -1;
    let m: RegExpExecArray | null;
    while ((m = re.exec(window)) !== null) {
      if (m.index >= minBreakOffset) {
        last = m.index + m[0].length;
      }
    }
    if (last > 0) return start + last;
  }
  return end; // hard cut
}
