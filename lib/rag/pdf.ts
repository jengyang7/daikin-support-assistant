import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export interface PdfPage {
  pageNumber: number; // 1-based
  text: string;
}

/**
 * Parse a PDF buffer into per-page plain text.
 * Uses unpdf which is serverless-safe (no native deps, no canvas).
 */
export async function parsePdf(buffer: ArrayBuffer): Promise<{
  pageCount: number;
  pages: PdfPage[];
}> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  // unpdf returns text as string[] (one entry per page) when mergePages is false.
  const pageTexts = Array.isArray(text) ? text : [text];

  const pages: PdfPage[] = pageTexts.map((t, i) => ({
    pageNumber: i + 1,
    text: normalizeWhitespace(t ?? ""),
  }));

  return { pageCount: totalPages, pages };
}

function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
