import { NextRequest, NextResponse } from "next/server";
import { ingestPdf } from "@/lib/rag/ingest";
import type { DocType, Product } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300; // PDF embedding can take a while

const VALID_PRODUCTS = new Set<Product>([
  "reiri_home",
  "reiri_office",
  "reiri_hotel",
]);
const VALID_DOC_TYPES = new Set<DocType>([
  "catalogue",
  "datasheet",
  "installation",
  "user_manual",
]);

/**
 * POST /api/ingest
 *
 * Multipart form fields:
 *   file:        the PDF (required)
 *   title:       display title (required)
 *   product:     reiri_home | reiri_office | reiri_hotel | "" (optional)
 *   doc_type:    catalogue | datasheet | installation | user_manual | "" (optional)
 *   description: short blurb shown on the document card (optional)
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const productRaw = String(form.get("product") ?? "").trim();
  const docTypeRaw = String(form.get("doc_type") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json(
      { error: `Unsupported content-type: ${file.type}` },
      { status: 400 },
    );
  }
  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 });
  }

  const product =
    productRaw && VALID_PRODUCTS.has(productRaw as Product)
      ? (productRaw as Product)
      : null;
  const docType =
    docTypeRaw && VALID_DOC_TYPES.has(docTypeRaw as DocType)
      ? (docTypeRaw as DocType)
      : null;

  try {
    const bytes = await file.arrayBuffer();
    const result = await ingestPdf({
      filename: file.name,
      title,
      product,
      docType,
      description,
      fileBytes: bytes,
      contentType: file.type || "application/pdf",
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/ingest]", err);
    return NextResponse.json(
      { error: "Ingestion failed", details: String(err) },
      { status: 500 },
    );
  }
}
