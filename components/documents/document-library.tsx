"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DOC_TYPE_LABELS,
  PRODUCT_LABELS,
  type DocType,
  type Product,
} from "@/types";
import { DocumentCard, type DocumentWithUrl } from "./document-card";
import { UploadDialog } from "./upload-dialog";

const DOC_TYPE_FILTERS: ("all" | DocType)[] = [
  "all",
  "manual",
  "guide",
  "technical",
  "reference",
];

const PRODUCT_FILTERS: ("all" | Product)[] = [
  "all",
  "reiri_home",
  "reiri_office",
  "reiri_hotel",
];

export function DocumentLibrary() {
  const [docs, setDocs] = useState<DocumentWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DocType>("all");
  const [productFilter, setProductFilter] = useState<"all" | Product>("all");
  const [uploadOpen, setUploadOpen] = useState(false);

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

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return docs.filter((d) => {
      if (typeFilter !== "all" && d.doc_type !== typeFilter) return false;
      if (productFilter !== "all" && d.product !== productFilter) return false;
      if (q) {
        const hay = `${d.title} ${d.filename} ${d.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, search, typeFilter, productFilter]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="text-[15px] font-semibold text-slate-800">
          Document Library
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-dark"
        >
          <Upload className="h-4 w-4" />
          Upload PDF
        </button>
      </header>

      {/* Body */}
      <div className="scroll-thin flex-1 overflow-y-auto px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-800">Knowledge Base</h1>
        <p className="mt-1 text-[14px] text-slate-500">
          Browse and manage Daikin technical documentation
        </p>

        {/* Search + filters */}
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] outline-none focus:border-brand"
            />
          </div>
          <div className="flex gap-1.5">
            {DOC_TYPE_FILTERS.map((t) => (
              <FilterPill
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
              >
                {t === "all" ? "All" : DOC_TYPE_LABELS[t as DocType]}
              </FilterPill>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[12px] text-slate-500">
          <span className="font-medium text-slate-600">Product</span>
          {PRODUCT_FILTERS.map((p) => (
            <FilterPill
              key={p}
              active={productFilter === p}
              onClick={() => setProductFilter(p)}
            >
              {p === "all" ? "All Products" : PRODUCT_LABELS[p as Product]}
            </FilterPill>
          ))}
        </div>

        <div className="mt-4 text-[12px] text-slate-500">
          {loading ? "Loading…" : `${filtered.length} documents found`}
        </div>

        {/* Grid */}
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((d) => (
            <DocumentCard key={d.id} doc={d} onDelete={handleDelete} />
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="mt-12 text-center text-[14px] text-slate-400">
            {docs.length === 0
              ? 'No documents yet — click "Upload PDF" to add the first one.'
              : "No documents match the current filters."}
          </div>
        )}
      </div>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={refresh}
      />
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[12px] font-medium transition",
        active
          ? "border-brand bg-brand/10 text-brand"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}
