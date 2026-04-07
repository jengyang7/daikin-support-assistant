"use client";
import { useEffect, useState } from "react";
import type { Citation } from "@/types";

interface DocApiResponse {
  documents: Array<{ id: string; url: string | null }>;
}

let cache: Map<string, string> | null = null;
let inflight: Promise<Map<string, string>> | null = null;

async function loadUrls(): Promise<Map<string, string>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch("/api/documents", { cache: "no-store" });
    if (!res.ok) return new Map();
    const data: DocApiResponse = await res.json();
    const map = new Map<string, string>();
    for (const d of data.documents) {
      if (d.url) map.set(d.id, d.url);
    }
    cache = map;
    return map;
  })();
  return inflight;
}

/**
 * Returns a map of document_id -> signed PDF URL for the documents referenced
 * by the given citations. Cached process-wide so we don't refetch per bubble.
 */
export function useDocumentUrls(citations: Citation[]): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(() => cache ?? new Map());

  useEffect(() => {
    if (citations.length === 0) return;
    let mounted = true;
    loadUrls().then((m) => {
      if (mounted) setMap(new Map(m));
    });
    return () => {
      mounted = false;
    };
  }, [citations.length]);

  return map;
}
