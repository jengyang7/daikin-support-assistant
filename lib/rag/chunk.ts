import type { PdfPage } from "./pdf";

export interface Chunk {
  pageNumber: number;
  content: string;
}

// Rough heuristic: 1 token ≈ 4 characters of English text.
const CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = 800;
const OVERLAP_TOKENS = 100;

const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN; // ~3200
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN; // ~400

/**
 * Page-aware recursive chunker.
 *
 * Each chunk stays within a single PDF page so the page citation we surface in
 * the chat UI is always accurate. Pages longer than ~3200 chars are split into
 * sliding windows with ~400-char overlap; short pages become a single chunk.
 *
 * Splitting prefers semantic boundaries: blank lines first, then sentence ends,
 * then word boundaries, falling back to a hard character cut.
 */
export function chunkPages(pages: PdfPage[]): Chunk[] {
  const out: Chunk[] = [];
  for (const page of pages) {
    const text = page.text;
    if (!text || text.length < 40) continue; // skip empty / near-empty pages

    if (text.length <= TARGET_CHARS) {
      out.push({ pageNumber: page.pageNumber, content: text });
      continue;
    }

    const parts = splitText(text, TARGET_CHARS, OVERLAP_CHARS);
    for (const p of parts) {
      out.push({ pageNumber: page.pageNumber, content: p });
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
