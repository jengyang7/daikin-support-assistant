"use client";
import { Upload, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DOC_TYPE_LABELS,
  PRODUCT_LABELS,
  type DocType,
  type Product,
} from "@/types";

const PRODUCT_OPTIONS: (Product | "")[] = [
  "",
  "reiri_home",
  "reiri_office",
  "reiri_hotel",
];
const DOC_TYPE_OPTIONS: (DocType | "")[] = [
  "",
  "manual",
  "guide",
  "technical",
  "reference",
];

export function UploadDialog({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [product, setProduct] = useState<Product | "">("");
  const [docType, setDocType] = useState<DocType | "">("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  function reset() {
    setFile(null);
    setTitle("");
    setProduct("");
    setDocType("");
    setDescription("");
    setError(null);
    setBusy(false);
  }

  function handleFile(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError("File too large (max 25MB)");
      return;
    }
    setError(null);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
  }

  async function handleUpload() {
    if (!file || !title.trim()) {
      setError("File and title are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      fd.append("product", product);
      fd.append("doc_type", docType);
      fd.append("description", description.trim());
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed: ${res.status}`);
      }
      reset();
      onUploaded();
      onClose();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Upload PDF</h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              The document will be parsed, embedded, and added to the knowledge base.
            </p>
          </div>
          <button onClick={onClose} disabled={busy}>
            <X className="h-5 w-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* Drop zone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition",
            drag
              ? "border-brand bg-brand/5"
              : "border-slate-200 bg-slate-50 hover:border-brand",
          )}
        >
          <Upload className="mb-2 h-6 w-6 text-slate-400" />
          {file ? (
            <div>
              <div className="text-[14px] font-medium text-slate-700">{file.name}</div>
              <div className="text-[11px] text-slate-400">Click to change</div>
            </div>
          ) : (
            <>
              <div className="text-[14px] text-slate-600">
                Drag a PDF here or click to browse
              </div>
              <div className="text-[11px] text-slate-400">Max 25MB</div>
            </>
          )}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {/* Metadata */}
        <div className="mt-4 space-y-3">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Reiri for Office Installation Manual"
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Product">
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value as Product | "")}
                className="input"
              >
                {PRODUCT_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p ? PRODUCT_LABELS[p] : "— None —"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType | "")}
                className="input"
              >
                {DOC_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t ? DOC_TYPE_LABELS[t] : "— None —"}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Short description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="input resize-none"
              placeholder="Briefly describe what this document covers"
            />
          </Field>
        </div>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={busy || !file || !title.trim()}
            className="rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "Uploading…" : "Upload & embed"}
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 6px;
          border: 1px solid rgb(226 232 240);
          padding: 8px 10px;
          font-size: 13px;
          color: rgb(30 41 59);
          background: white;
          outline: none;
        }
        :global(.input:focus) {
          border-color: #19b8d6;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      {children}
    </label>
  );
}
