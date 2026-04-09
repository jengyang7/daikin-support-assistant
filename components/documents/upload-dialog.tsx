"use client";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  DOC_TYPE_LABELS,
  PRODUCT_LABELS,
  type DocType,
  type Product,
} from "@/types";

const PRODUCT_OPTIONS: (Product | "")[] = [
  "",
  "reiri_all",
  "reiri_home",
  "reiri_office",
  "reiri_hotel",
  "reiri_resort",
];
const DOC_TYPE_OPTIONS: (DocType | "")[] = [
  "",
  "catalogue",
  "datasheet",
  "installation",
  "user_manual",
];

function detectProduct(filename: string): Product | "" {
  const f = filename.toLowerCase().replace(/-/g, " ").replace(/_/g, " ");
  if (f.includes("reiri for resort") || f.includes("reiriresort")) return "reiri_resort";
  if (f.includes("reiri for hotel") || f.includes("reirihotel")) return "reiri_hotel";
  if (f.includes("reiri for office") || f.includes("reirioffice")) return "reiri_office";
  if (f.includes("reiri for home") || f.includes("reirihome")) return "reiri_home";
  // fallback: plain product name without "for"
  if (f.includes("reiri resort")) return "reiri_resort";
  if (f.includes("reiri hotel")) return "reiri_hotel";
  if (f.includes("reiri office")) return "reiri_office";
  if (f.includes("reiri home")) return "reiri_home";
  // generic reiri docs (e.g. "adaptor for reiri", "adapter box") apply to all products
  if (f.includes("reiri") || f.includes("adapter") || f.includes("adaptor")) return "reiri_all";
  return "";
}

function detectDocType(filename: string): DocType | "" {
  const f = filename.toLowerCase();
  if (f.includes("catalogue") || f.includes("catalog")) return "catalogue";
  if (f.includes("datasheet") || f.includes("data_sheet") || f.includes("data sheet")) return "datasheet";
  if (f.includes("installation") || f.includes("install manual")) return "installation";
  if (f.includes("user_manual") || f.includes("user manual") || f.includes("usermanual")) return "user_manual";
  return "";
}

type Status = "pending" | "uploading" | "done" | "error";

interface FileEntry {
  id: string;
  file: File;
  title: string;
  product: Product | "";
  docType: DocType | "";
  status: Status;
  error?: string;
}

function makeEntry(file: File): FileEntry | null {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return null;
  if (file.size > 25 * 1024 * 1024) return null;
  return {
    id: `${file.name}-${file.lastModified}-${Math.random()}`,
    file,
    title: file.name.replace(/\.pdf$/i, ""),
    product: detectProduct(file.name),
    docType: detectDocType(file.name),
    status: "pending",
  };
}

export function UploadDialog({
  open,
  onClose,
  onUploaded,
  initialFiles,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
  initialFiles?: File[] | null;
}) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setEntries([]);
    setBusy(false);
    setGlobalError(null);
    setAllDone(false);
  }

  useEffect(() => {
    if (!open) return;
    reset();
    if (initialFiles?.length) {
      const valid = initialFiles.flatMap(f => makeEntry(f) ?? []);
      if (valid.length) setEntries(valid);
      const skipped = initialFiles.length - valid.length;
      if (skipped > 0) setGlobalError(`${skipped} file(s) skipped — must be PDF under 25 MB`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || busy || !allDone || entries.length === 0) return;
    if (entries.every(entry => entry.status === "done")) {
      onClose();
    }
  }, [allDone, busy, entries, onClose, open]);

  function addFiles(files: File[]) {
    const existing = new Set(entries.map(e => e.file.name + e.file.size));
    const newEntries = files.flatMap(f => {
      if (existing.has(f.name + f.size)) return [];
      return makeEntry(f) ?? [];
    });
    const skipped = files.length - newEntries.length;
    if (skipped > 0) setGlobalError(`${skipped} file(s) skipped — must be PDF under 25 MB`);
    else setGlobalError(null);
    setEntries(prev => [...prev, ...newEntries]);
  }

  function removeEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  function updateEntry(id: string, patch: Partial<Pick<FileEntry, "title" | "product" | "docType">>) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }

  function setEntryStatus(id: string, status: Status, error?: string) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status, error } : e));
  }

  async function handleUploadAll() {
    const pending = entries.filter(e => e.status === "pending" || e.status === "error");
    if (pending.length === 0) return;
    setBusy(true);
    setGlobalError(null);

    for (const entry of pending) {
      if (!entry.title.trim()) {
        setEntryStatus(entry.id, "error", "Title is required");
        continue;
      }
      setEntryStatus(entry.id, "uploading");
      try {
        const fd = new FormData();
        fd.append("file", entry.file);
        fd.append("title", entry.title.trim());
        fd.append("product", entry.product);
        fd.append("doc_type", entry.docType);
        const res = await fetch("/api/ingest", { method: "POST", body: fd });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Upload failed: ${res.status}`);
        }
        setEntryStatus(entry.id, "done");
        onUploaded();
      } catch (err) {
        setEntryStatus(entry.id, "error", String(err instanceof Error ? err.message : err));
      }
    }

    setBusy(false);
    setAllDone(true);
  }

  if (!open) return null;

  const pendingCount = entries.filter(e => e.status === "pending").length;
  const errorCount = entries.filter(e => e.status === "error").length;
  const doneCount = entries.filter(e => e.status === "done").length;
  const uploadableCount = entries.filter(e => e.status === "pending" || e.status === "error").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-800">Upload PDFs</h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Files are parsed, embedded, and added to the knowledge base.
            </p>
          </div>
          <button onClick={onClose} disabled={busy} className="mt-0.5 rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Drop zone */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition",
              drag ? "border-brand bg-brand/5" : "border-slate-200 bg-slate-50 hover:border-brand",
            )}
          >
            <Upload className="mb-1.5 h-5 w-5 text-slate-400" />
            <div className="text-[13px] text-slate-600">Drop PDFs here or click to browse</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Multiple files supported · Max 25 MB each</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
            />
          </label>

          {globalError && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-700">{globalError}</div>
          )}

          {/* File list */}
          {entries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                  Files ({entries.length})
                </span>
                {allDone && doneCount > 0 && (
                  <span className="text-[12px] text-emerald-600 font-medium">
                    {doneCount} uploaded successfully{errorCount > 0 ? `, ${errorCount} failed` : ""}
                  </span>
                )}
              </div>

              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-lg border p-3 transition",
                    entry.status === "done" && "border-emerald-200 bg-emerald-50",
                    entry.status === "error" && "border-red-200 bg-red-50",
                    entry.status === "uploading" && "border-brand/30 bg-brand/5",
                    entry.status === "pending" && "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {/* Status icon */}
                    <div className="mt-0.5 flex-shrink-0">
                      {entry.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {entry.status === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                      {entry.status === "uploading" && <Loader2 className="h-4 w-4 text-brand animate-spin" />}
                      {entry.status === "pending" && <FileText className="h-4 w-4 text-slate-400" />}
                    </div>

                    {/* Fields */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        value={entry.title}
                        onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
                        disabled={entry.status === "uploading" || entry.status === "done"}
                        placeholder="Document title"
                        className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 outline-none focus:border-brand disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:text-slate-700 disabled:font-medium"
                      />
                      <div className="flex gap-2">
                        <select
                          value={entry.product}
                          onChange={(e) => updateEntry(entry.id, { product: e.target.value as Product | "" })}
                          disabled={entry.status === "uploading" || entry.status === "done"}
                          className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-brand disabled:opacity-50"
                        >
                          {PRODUCT_OPTIONS.map((p) => (
                            <option key={p} value={p}>{p ? PRODUCT_LABELS[p] : "— Product —"}</option>
                          ))}
                        </select>
                        <select
                          value={entry.docType}
                          onChange={(e) => updateEntry(entry.id, { docType: e.target.value as DocType | "" })}
                          disabled={entry.status === "uploading" || entry.status === "done"}
                          className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-brand disabled:opacity-50"
                        >
                          {DOC_TYPE_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t ? DOC_TYPE_LABELS[t] : "— Type —"}</option>
                          ))}
                        </select>
                      </div>
                      {entry.status === "error" && entry.error && (
                        <div className="text-[11px] text-red-600">{entry.error}</div>
                      )}
                    </div>

                    {/* Remove */}
                    {entry.status !== "uploading" && entry.status !== "done" && (
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="mt-0.5 flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {allDone && errorCount === 0 ? "Close" : "Cancel"}
          </button>
          <button
            onClick={handleUploadAll}
            disabled={busy || uploadableCount === 0}
            className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy
              ? "Uploading…"
              : uploadableCount > 0
              ? `Upload ${uploadableCount} PDF${uploadableCount > 1 ? "s" : ""}`
              : "Upload PDFs"}
          </button>
        </div>
      </div>
    </div>
  );
}
