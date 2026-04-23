"use client";
import { FileText, Wrench, BookOpen, LayoutGrid, Trash2, ExternalLink, Star, ClipboardList, FolderOpen } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import {
  DOC_TYPE_LABELS,
  PRODUCT_LABELS,
  type DocType,
  type Product,
  type DocumentRow,
} from "@/types";
import { DOC_TYPE_BADGE_COLORS, DOC_TYPE_ICON_COLORS } from "./doc-type-theme";

export interface DocumentWithUrl extends DocumentRow {
  url: string | null;
}

const DOC_TYPE_ICONS: Record<DocType, React.ElementType> = {
  catalogue: LayoutGrid,
  datasheet: FileText,
  installation: Wrench,
  user_manual: BookOpen,
  specification: ClipboardList,
  other: FolderOpen,
};

export function DocumentCard({
  doc,
  onDelete,
  isFavourite,
  onToggleFavourite,
  canFavourite,
}: {
  doc: DocumentWithUrl;
  onDelete: (id: string) => void;
  isFavourite: boolean;
  onToggleFavourite: (id: string) => void;
  canFavourite: boolean;
}) {
  const Icon = doc.doc_type ? DOC_TYPE_ICONS[doc.doc_type] : FileText;
  const iconColor = doc.doc_type ? DOC_TYPE_ICON_COLORS[doc.doc_type] : "text-slate-400 bg-slate-50";

  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-brand/40">
      {/* Favourite button — top-right corner, always visible */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavourite(doc.id); }}
        disabled={!canFavourite}
        title={isFavourite ? "Remove from favourites" : canFavourite ? "Add to favourites" : "Max 3 favourites reached"}
        className={cn(
          "absolute right-3 top-3 rounded p-1 transition",
          isFavourite
            ? "text-amber-400 hover:text-amber-500"
            : canFavourite
            ? "text-slate-200 hover:text-amber-400"
            : "cursor-not-allowed text-slate-100",
        )}
      >
        <Star className={cn("h-4 w-4", isFavourite && "fill-current")} />
      </button>

      {/* Icon + title row */}
      <div className="flex items-start gap-3 pr-6">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[14px] font-semibold leading-snug text-slate-800 line-clamp-2"
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
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${DOC_TYPE_BADGE_COLORS[doc.doc_type]}`}>
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
