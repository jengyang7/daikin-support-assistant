"use client";
import { Paperclip, Mic, Send, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { PRODUCT_LABELS, type Product } from "@/types";
import { resizeImageFile, type AttachedImage } from "@/lib/images";

const PRODUCTS: Product[] = ["reiri_home", "reiri_office", "reiri_hotel", "reiri_resort"];
const MAX_IMAGES = 3;

export function ChatInput({
  onSubmit,
  disabled,
  products,
  onProductChange,
  value,
  onValueChange,
  images,
  onImagesChange,
  floating = true,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  products: Product[];
  onProductChange: (p: Product[]) => void;
  value: string;
  onValueChange: (v: string) => void;
  images: AttachedImage[];
  onImagesChange: (imgs: AttachedImage[]) => void;
  floating?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize when value changes externally (e.g. from example click)
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 140)}px`;
  }, [value]);

  const canSend = (value.trim().length > 0 || images.length > 0) && !disabled;

  function send() {
    if (!canSend) return;
    onSubmit(value.trim());
    onValueChange("");
    if (taRef.current) taRef.current.style.height = "auto";
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function toggleProduct(p: Product) {
    if (products.includes(p)) {
      onProductChange(products.filter((x) => x !== p));
    } else {
      onProductChange([...products, p]);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    const toProcess = files.slice(0, remaining);

    const resized = await Promise.all(toProcess.map((f) => resizeImageFile(f)));
    onImagesChange([...images, ...resized]);

    // Reset the input so the same file can be re-selected if removed
    e.target.value = "";
  }

  function removeImage(index: number) {
    onImagesChange(images.filter((_, i) => i !== index));
  }

  return (
    <div className={cn(
      "w-full max-w-3xl px-4",
      floating
        ? "absolute bottom-2 left-1/2 -translate-x-1/2 pb-2"
        : "relative mx-auto",
    )}>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 overflow-hidden">
        {/* Image thumbnails */}
        {images.length > 0 && (
          <div className="flex gap-2 px-4 pt-3">
            {images.map((img, i) => (
              <div key={i} className="relative flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.dataUrl}
                  alt={`Attachment ${i + 1}`}
                  className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-900"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text input row */}
        <div className="flex items-end gap-2 px-4 py-3">
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => {
              onValueChange(e.target.value);
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 140)}px`;
            }}
            onKeyDown={handleKey}
            rows={1}
            placeholder="Ask about specific component testing or part numbers…"
            className="max-h-36 flex-1 resize-none bg-transparent py-0.5 text-[14px] text-slate-800 outline-none placeholder:text-slate-400"
            disabled={disabled}
          />
          <div className="flex flex-shrink-0 items-center gap-1">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={disabled || images.length >= MAX_IMAGES}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || images.length >= MAX_IMAGES}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                images.length >= MAX_IMAGES
                  ? "cursor-not-allowed text-slate-200"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
              )}
              aria-label="Attach image"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Voice input"
              tabIndex={-1}
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              onClick={send}
              disabled={!canSend}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Product filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-4 pt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button
            onClick={() => onProductChange([])}
            className={cn(
              "flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
              products.length === 0
                ? "border-brand bg-brand text-white"
                : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700",
            )}
          >
            All
          </button>
          {PRODUCTS.map((p) => (
            <button
              key={p}
              onClick={() => toggleProduct(p)}
              className={cn(
                "flex-shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                products.includes(p)
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700",
              )}
            >
              {PRODUCT_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
