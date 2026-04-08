"use client";
import { FileText, Wrench, BookOpen, LayoutGrid, Trash2, ExternalLink } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import {
  DOC_TYPE_LABELS,
  PRODUCT_LABELS,
  type DocType,
  type Product,
  type DocumentRow,
} from "@/types";

export interface DocumentWithUrl extends DocumentRow {
  url: string | null;
}

const DOC_TYPE_ICONS: Record<DocType, React.ElementType> = {
  catalogue: LayoutGrid,
  datasheet: FileText,
  installation: Wrench,
  user_manual: BookOpen,
};

const DOC_TYPE_COLORS: Record<DocType, string> = {
  catalogue: "text-purple-500 bg-purple-50",
  datasheet: "text-blue-500 bg-blue-50",
  installation: "text-amber-500 bg-amber-50",
  user_manual: "text-emerald-500 bg-emerald-50",
};

const DOC_TYPE_BADGE: Record<DocType, string> = {
  catalogue: "bg-purple-50 text-purple-600 border-purple-200",
  datasheet: "bg-blue-50 text-blue-600 border-blue-200",
  installation: "bg-amber-50 text-amber-600 border-amber-200",
  user_manual: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

function formatReadableDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DocumentCard({
  doc,
  onDelete,
}: {
  doc: DocumentWithUrl;
  onDelete: (id: string) => void;
}) {
  const Icon = doc.doc_type ? DOC_TYPE_ICONS[doc.doc_type] : FileText;
  const iconColor = doc.doc_type ? DOC_TYPE_COLORS[doc.doc_type] : "text-slate-400 bg-slate-50";

  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-brand/40">
      {/* Icon + title row */}
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[14px] font-semibold leading-snug text-slate-800 line-clamp-2 group-hover:line-clamp-none transition-all"
            title={doc.title}
          >
            {doc.title}
          </div>
          {doc.description && (
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500 line-clamp-2">
              {doc.description}
            </p>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {doc.doc_type && (
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${DOC_TYPE_BADGE[doc.doc_type]}`}>
            {DOC_TYPE_LABELS[doc.doc_type]}
          </span>
        )}
        {doc.product && (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {PRODUCT_LABELS[doc.product]}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1">
          {doc.page_count != null && doc.page_count > 0 && (
            <span>{doc.page_count} pages</span>
          )}
          {doc.page_count != null && doc.page_count > 0 &&
           doc.file_size_bytes != null && doc.file_size_bytes > 0 && (
            <span> · </span>
          )}
          {doc.file_size_bytes != null && doc.file_size_bytes > 0 && (
            <span>{formatBytes(doc.file_size_bytes)}</span>
          )}
          {doc.created_at && (
            <span className={doc.page_count || (doc.file_size_bytes && doc.file_size_bytes > 0) ? " · " : ""}>
              {formatReadableDate(doc.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          {doc.url && (
            <button
              onClick={(e) => { e.stopPropagation(); window.open(doc.url!, "_blank", "noreferrer"); }}
              className="rounded p-1 text-brand hover:bg-brand-light"
              aria-label="Open PDF"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete "${doc.title}"?`)) onDelete(doc.id);
            }}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
