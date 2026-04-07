"use client";
import { useEffect, useRef } from "react";
import { X, ExternalLink, FileText } from "lucide-react";
import type { Citation } from "@/types";

interface SourceDrawerProps {
  citation: Citation | null;
  query: string;
  url: string | null;
  onClose: () => void;
}

export function SourceDrawer({ citation, query, url, onClose }: SourceDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const open = citation !== null;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed inset-y-0 right-0 z-50 flex w-[420px] flex-col bg-white shadow-2xl transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Source details"
      >
        {citation && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-brand/10">
                  <FileText className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-slate-800 leading-snug">
                    {citation.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Page {citation.page_number}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-2 flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Score badges */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-2.5">
              <ScoreBadge label="Similarity" value={citation.similarity.toFixed(3)} />
              <ScoreBadge label="RRF" value={citation.rrf_score.toFixed(4)} />
              {citation.vector_rank !== null && (
                <ScoreBadge label="Vector rank" value={`#${citation.vector_rank}`} />
              )}
              {citation.keyword_rank !== null && (
                <ScoreBadge label="Keyword rank" value={`#${citation.keyword_rank}`} />
              )}
            </div>

            {/* Chunk content */}
            <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Retrieved chunk
              </div>
              <div
                className="whitespace-pre-wrap rounded-lg bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700 [&_mark]:bg-yellow-200 [&_mark]:text-slate-800 [&_mark]:rounded-sm [&_mark]:px-0.5"
                dangerouslySetInnerHTML={{
                  __html: highlightTerms(citation.content, query),
                }}
              />
            </div>

            {/* Footer link */}
            {url && (
              <div className="border-t border-slate-100 px-5 py-3">
                <a
                  href={`${url}#page=${citation.page_number}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[12px] font-medium text-brand hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open PDF at page {citation.page_number}
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function ScoreBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </span>
  );
}

/**
 * Wrap query terms (≥3 chars) in <mark> tags inside the chunk text.
 * The content is plain text so we escape HTML before wrapping.
 */
function highlightTerms(text: string, query: string): string {
  const escaped = escapeHtml(text);
  if (!query.trim()) return escaped;

  const terms = query
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .map((t) => escapeRegex(t));

  if (terms.length === 0) return escaped;

  const re = new RegExp(`(${terms.join("|")})`, "gi");
  return escaped.replace(re, "<mark>$1</mark>");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
