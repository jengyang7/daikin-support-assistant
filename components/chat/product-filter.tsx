"use client";
import { cn } from "@/lib/utils";
import { PRODUCT_LABELS, type Product } from "@/types";

const ORDER: Product[] = ["reiri_home", "reiri_office", "reiri_hotel", "reiri_resort", "marutto"];

export function ProductFilter({
  value,
  onChange,
}: {
  value: Product | null;
  onChange: (next: Product | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {ORDER.map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            onClick={() => onChange(active ? null : p)}
            className={cn(
              "rounded-full border px-3 py-1 text-[12px] font-medium transition",
              active
                ? "border-brand bg-brand/10 text-brand"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {PRODUCT_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}
