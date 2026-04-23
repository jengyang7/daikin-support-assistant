"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Upload, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DOC_TYPE_LABELS,
  PRODUCT_LABELS,
  type DocType,
  type Product,
} from "@/types";
import { DocumentCard, type DocumentWithUrl } from "./document-card";
import { UploadDialog } from "./upload-dialog";
import { PageSpinner } from "@/components/ui/loading-spinner";
import { DOC_TYPE_FILTER_STYLES } from "./doc-type-theme";

const PRODUCT_TABS: ("all" | Product)[] = [
  "all",
  "reiri_office",
  "reiri_home",
  "reiri_hotel",
  "reiri_resort",
  "marutto",
];

const DOC_TYPE_OPTIONS: ("all" | DocType)[] = [
  "all",
  "catalogue",
  "datasheet",
  "installation",
  "user_manual",
  "specification",
  "other",
];

const DOC_TYPE_ORDER: Record<string, number> = {
  catalogue: 0,
  datasheet: 1,
  installation: 2,
  user_manual: 3,
  specification: 4,
  other: 5,
};

const FAVS_KEY = "daikin_favourite_doc_ids";

export function DocumentLibrary() {
  const [docs, setDocs] = useState<DocumentWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DocType>("all");
  const [productFilter, setProductFilter] = useState<"all" | Product>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(FAVS_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  function toggleFavourite(id: string) {
    setFavouriteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      localStorage.setItem(FAVS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  function onPageDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDraggingOver(true);
  }

  function onPageDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDraggingOver(false);
  }

  function onPageDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function onPageDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setDroppedFiles(files);
      setUploadOpen(true);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      // Also remove from favourites if deleted
      setFavouriteIds(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        localStorage.setItem(FAVS_KEY, JSON.stringify([...next]));
        return next;
      });
      refresh();
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return docs
      .filter((d) => {
        if (typeFilter !== "all" && d.doc_type !== typeFilter) return false;
        if (productFilter !== "all" && d.product !== productFilter) return false;
        if (q) {
          const hay = `${d.title} ${d.filename} ${d.description ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const typeA = DOC_TYPE_ORDER[a.doc_type ?? ""] ?? 99;
        const typeB = DOC_TYPE_ORDER[b.doc_type ?? ""] ?? 99;
        if (typeA !== typeB) return typeA - typeB;
        return a.title.localeCompare(b.title);
      });
  }, [docs, search, typeFilter, productFilter]);


  return (
    <div
      className="relative flex h-full flex-1 flex-col overflow-hidden bg-chatbg"
      onDragEnter={onPageDragEnter}
      onDragLeave={onPageDragLeave}
      onDragOver={onPageDragOver}
      onDrop={onPageDrop}
    >
      {/* Full-page drag overlay */}
      {isDraggingOver && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-brand/10 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand bg-white/90 px-16 py-12 shadow-xl">
            <FileUp className="h-10 w-10 text-brand" />
            <div className="text-[18px] font-bold text-brand">Drop PDF to upload</div>
            <div className="text-[13px] text-slate-500">Release to open the upload form</div>
          </div>
        </div>
      )}

      <div className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
          {/* Hero banner */}
          <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1d71d5] to-[#4fa3e8] p-5 sm:p-8 text-white">
            <div className="pointer-events-none absolute inset-0 opacity-10">
              <svg viewBox="0 0 400 200" className="h-full w-full" preserveAspectRatio="xMaxYMid slice">
                <circle cx="350" cy="80" r="120" fill="none" stroke="white" strokeWidth="40" />
                <circle cx="320" cy="130" r="80" fill="none" stroke="white" strokeWidth="30" />
              </svg>
            </div>
            <div className="relative max-w-xl">
              <h1 className="text-[22px] sm:text-[28px] font-black leading-tight text-white">
                Daikin Technical<br />Knowledge Base
              </h1>
              <p className="mt-2 text-[13px] sm:text-[14px] text-white/80">
                Browse catalogues, datasheets, installation guides, and user manuals
                for the complete Reiri product range — all in one place.
              </p>
              <div className="mt-4 sm:mt-5 flex gap-3">
                <StatBadge value={`${docs.length}`} label="Documents" />
              </div>
            </div>
          </div>

          {/* Row 1: Product tabs (+ Upload button inline on desktop) */}
          <div className="mb-3 flex items-center gap-3">
            <div className="flex overflow-x-auto gap-1 rounded-xl bg-white p-1 shadow-sm border border-slate-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {PRODUCT_TABS.map((p) => (
                <button
                  key={p}
                  onClick={() => setProductFilter(p)}
                  className={cn(
                    "flex-shrink-0 rounded-lg px-3 sm:px-4 py-1.5 text-[13px] font-medium transition",
                    productFilter === p
                      ? "bg-brand text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {p === "all" ? "All Products" : PRODUCT_LABELS[p as Product]}
                </button>
              ))}
            </div>
            {/* Upload button: icon-only on mobile, full label on desktop */}
            <button
              onClick={() => setUploadOpen(true)}
              className="hidden sm:flex ml-auto flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-dark"
            >
              <Upload className="h-4 w-4" />
              Upload PDF
            </button>
          </div>

          {/* Row 2: Type filter + search */}
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex overflow-x-auto gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {DOC_TYPE_OPTIONS.map((type) => {
                const styles =
                  type === "all"
                    ? {
                        active: "bg-slate-100 text-slate-700 shadow-sm ring-1 ring-slate-300",
                        inactive: "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                      }
                    : DOC_TYPE_FILTER_STYLES[type];

                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      "flex-shrink-0 rounded-lg px-3 sm:px-4 py-1.5 text-[13px] font-medium transition",
                      typeFilter === type ? styles.active : styles.inactive,
                    )}
                  >
                    {type === "all" ? "All Types" : DOC_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-brand lg:w-56"
              />
            </div>
          </div>

          {/* Upload button — full-width, mobile only, after all filters */}
          <button
            onClick={() => setUploadOpen(true)}
            className="mb-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-dark sm:hidden"
          >
            <Upload className="h-4 w-4" />
            Upload PDF
          </button>

          {/* Document grid */}
          {loading ? (
            <PageSpinner />
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-[14px] text-slate-400">
              {docs.length === 0
                ? 'No documents yet — click "Upload PDF" to add the first one.'
                : "No documents match the current filters."}
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-slate-700">
                  {productFilter === "all" ? "All Documents" : PRODUCT_LABELS[productFilter as Product]}
                </h2>
                <span className="text-[12px] text-slate-400">{filtered.length} documents</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {filtered.map((d) => (
                  <DocumentCard
                    key={d.id}
                    doc={d}
                    onDelete={handleDelete}
                    isFavourite={favouriteIds.has(d.id)}
                    onToggleFavourite={toggleFavourite}
                    canFavourite={favouriteIds.size < 3 || favouriteIds.has(d.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); setDroppedFiles([]); }}
        onUploaded={refresh}
        initialFiles={droppedFiles}
      />
    </div>
  );
}

function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-4 py-2.5 backdrop-blur-sm">
      <div className="text-[22px] font-black text-white leading-none">{value}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/70">{label}</div>
    </div>
  );
}
