"use client";
import { FileText, Trash2 } from "lucide-react";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import {
  DOC_TYPE_LABELS,
  PRODUCT_LABELS,
  type DocumentRow,
} from "@/types";

export interface DocumentWithUrl extends DocumentRow {
  url: string | null;
}

export function DocumentCard({
  doc,
  onDelete,
}: {
  doc: DocumentWithUrl;
  onDelete: (id: string) => void;
}) {
  const handleClick = () => {
    if (doc.url) window.open(doc.url, "_blank", "noreferrer");
  };
  return (
    <div
      onClick={handleClick}
      className="group relative flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md"
    >
      {/* Header: PDF icon + title */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-red-50 text-red-500">
          <FileText className="h-5 w-5" />
          <span className="sr-only">PDF</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[14px] font-semibold leading-snug text-slate-800">
            {doc.title}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete "${doc.title}"?`)) onDelete(doc.id);
          }}
          className="opacity-0 transition group-hover:opacity-100"
          aria-label="Delete document"
        >
          <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
        </button>
      </div>

      {/* Tags */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {doc.doc_type && (
          <Tag tone="brand">{DOC_TYPE_LABELS[doc.doc_type]}</Tag>
        )}
        {doc.product && <Tag tone="slate">{PRODUCT_LABELS[doc.product]}</Tag>}
      </div>

      {/* Description */}
      {doc.description && (
        <p className="mt-2.5 line-clamp-2 text-[12px] leading-relaxed text-slate-500">
          {doc.description}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-end justify-between text-[11px] text-slate-400">
        <div>
          {doc.page_count != null && <span>{doc.page_count} pages</span>}
          {doc.page_count != null && doc.file_size_bytes != null && (
            <span> · </span>
          )}
          {doc.file_size_bytes != null && (
            <span>{formatBytes(doc.file_size_bytes)}</span>
          )}
        </div>
        <div>{formatDate(doc.created_at)}</div>
      </div>
    </div>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "brand" | "slate";
}) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "brand"
          ? "bg-brand/10 text-brand"
          : "bg-slate-100 text-slate-600",
      )}
    >
      {children}
    </span>
  );
}
