"use client";
import { Paperclip, Mic, Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { PRODUCT_LABELS, type Product } from "@/types";

const PRODUCTS: Product[] = ["reiri_home", "reiri_office", "reiri_hotel", "reiri_resort"];

export function ChatInput({
  onSubmit,
  disabled,
  products,
  onProductChange,
  value,
  onValueChange,
  floating = true,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  products: Product[];
  onProductChange: (p: Product[]) => void;
  value: string;
  onValueChange: (v: string) => void;
  floating?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize when value changes externally (e.g. from example click)
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 140)}px`;
  }, [value]);

  function send() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
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

  return (
    <div className={cn(
      "w-full max-w-3xl px-4",
      floating
        ? "absolute bottom-6 left-1/2 -translate-x-1/2 pb-6"
        : "relative mx-auto",
    )}>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 overflow-hidden">
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
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Attach file"
              tabIndex={-1}
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
              disabled={disabled || !value.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Product filter pills */}
        <div className="flex items-center gap-1.5 px-4 pb-4 pt-2">
          <button
            onClick={() => onProductChange([])}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
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
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
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
