"use client";
import { FileText } from "lucide-react";
import { useContext } from "react";
import type { Citation } from "@/types";
import { SourceContext } from "./source-context";

export function SourceChip({
  citation,
}: {
  citation: Citation;
}) {
  const openSource = useContext(SourceContext);
  const label = `${citation.title} p.${citation.page_number}`;

  return (
    <button
      onClick={() => openSource(citation)}
      className="inline-flex max-w-[260px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-medium text-slate-700 transition hover:border-brand hover:bg-brand/5 cursor-pointer"
      title={label}
    >
      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-brand" />
      <span className="truncate">{label}</span>
    </button>
  );
}
