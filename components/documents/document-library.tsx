"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Upload, Star, MessageSquare } from "lucide-react";
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
import Link from "next/link";

const PRODUCT_TABS: ("all" | Product)[] = [
  "all",
  "reiri_office",
  "reiri_home",
  "reiri_hotel",
];

const DOC_TYPE_OPTIONS: ("all" | DocType)[] = [
  "all",
  "catalogue",
  "datasheet",
  "installation",
  "user_manual",
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

  useEffect(() => { refresh(); }, []);

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

  const recentDocs = useMemo(() => [...docs].slice(0, 3), [docs]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-chatbg">

      <div className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {/* Hero banner */}
          <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1d71d5] to-[#4fa3e8] p-8 text-white">
            {/* Abstract swirl overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-10">
              <svg viewBox="0 0 400 200" className="h-full w-full" preserveAspectRatio="xMaxYMid slice">
                <circle cx="350" cy="80" r="120" fill="none" stroke="white" strokeWidth="40" />
                <circle cx="320" cy="130" r="80" fill="none" stroke="white" strokeWidth="30" />
              </svg>
            </div>
            <div className="relative max-w-xl">
              <h1 className="text-[28px] font-black leading-tight text-white">
                Daikin Technical<br />Knowledge Base
              </h1>
              <p className="mt-2 text-[14px] text-white/80">
                Access the complete ecosystem of Reiri climate control documentation.
                Engineered for speed, designed for clarity.
              </p>
              <div className="mt-5 flex gap-3">
                <StatBadge value={`${docs.length}`} label="Documents" />
              </div>
            </div>
          </div>

          {/* Filters row */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            {/* Product tabs */}
            <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm border border-slate-200">
              {PRODUCT_TABS.map((p) => (
                <button
                  key={p}
                  onClick={() => setProductFilter(p)}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-[13px] font-medium transition",
                    productFilter === p
                      ? "bg-white text-brand shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  {p === "all" ? "All Products" : PRODUCT_LABELS[p as Product]}
                </button>
              ))}
            </div>

            {/* Type dropdown + search + upload */}
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | DocType)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 outline-none focus:border-brand"
              >
                <option value="all">All Documents</option>
                {DOC_TYPE_OPTIONS.slice(1).map((t) => (
                  <option key={t} value={t}>{DOC_TYPE_LABELS[t as DocType]}</option>
                ))}
              </select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-44 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-brand"
                />
              </div>
              <button
                onClick={() => setUploadOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-brand-dark"
              >
                <Upload className="h-4 w-4" />
                Upload PDF
              </button>
            </div>
          </div>

          {/* Two-column layout: main content + right sidebar */}
          <div className="flex gap-5">
            {/* Main: document grid */}
            <div className="flex-1 min-w-0">
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
                      <DocumentCard key={d.id} doc={d} onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="w-64 flex-shrink-0 space-y-4">
              {/* Top Resources */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-400" />
                  <span className="text-[13px] font-semibold text-slate-700">Top Resources</span>
                </div>
                <div className="space-y-2">
                  {recentDocs.length === 0 ? (
                    <div className="text-[12px] text-slate-400">No documents yet</div>
                  ) : (
                    recentDocs.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => d.url && window.open(d.url, "_blank")}
                        className="flex w-full items-start justify-between gap-2 rounded-lg p-2 text-left text-[12px] hover:bg-slate-50"
                      >
                        <div>
                          <div className="font-medium text-slate-700 line-clamp-1">{d.title}</div>
                          {d.doc_type && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {DOC_TYPE_LABELS[d.doc_type]}
                            </div>
                          )}
                        </div>
                        <span className="mt-0.5 text-slate-300">›</span>
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={() => setProductFilter("all")}
                  className="mt-3 text-[12px] font-semibold text-brand hover:underline"
                >
                  See All Popular Docs
                </button>
              </div>

              {/* Can't find a manual */}
              <div className="rounded-xl bg-slate-900 p-4 text-white">
                <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  Direct Support
                </div>
                <div className="text-[15px] font-bold leading-snug">
                  Can&apos;t find a manual?
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">
                  Our AI assistant is trained on the entire Daikin internal database.
                </p>
                <Link
                  href="/chat"
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  <MessageSquare className="h-4 w-4" />
                  Ask Daikin AI
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={refresh}
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
