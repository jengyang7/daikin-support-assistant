import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase/server";
import type { DocumentRow } from "@/types";

export const runtime = "nodejs";

/**
 * GET /api/documents
 *
 * Returns all documents (newest first) with a short-lived signed URL for each
 * PDF, so the Document Library cards and chat citation chips can link directly
 * to the file. Filtering is done client-side from this list.
 */
export async function GET(_req: NextRequest) {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const docs = (data ?? []) as DocumentRow[];

  // Sign all storage paths in one go (1-hour expiry).
  const paths = docs.map((d) => d.storage_path);
  const signedMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error: signErr } = await supa.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(paths, 3600);
    if (signErr) {
      return NextResponse.json({ error: signErr.message }, { status: 500 });
    }
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl);
    }
  }

  return NextResponse.json({
    documents: docs.map((d) => ({
      ...d,
      url: signedMap.get(d.storage_path) ?? null,
    })),
  });
}

/**
 * DELETE /api/documents?id=<uuid>
 * Removes the document, cascades the chunks (FK on delete), and deletes the
 * underlying storage object.
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data: doc, error: fetchErr } = await supa
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: delErr } = await supa.from("documents").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  await supa.storage
    .from(STORAGE_BUCKET)
    .remove([doc.storage_path])
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
