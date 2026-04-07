"use client";
import { FileText } from "lucide-react";
import type { Citation } from "@/types";

export function SourceChip({
  citation,
  url,
}: {
  citation: Citation;
  url: string | null;
}) {
  const label = `${citation.title} p.${citation.page_number}`;
  const inner = (
    <>
      <FileText className="h-3.5 w-3.5 text-brand" />
      <span className="truncate">{label}</span>
    </>
  );
  const className =
    "inline-flex max-w-[260px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-medium text-slate-700 transition hover:border-brand hover:bg-brand/5";
  if (!url) {
    return <span className={className}>{inner}</span>;
  }
  return (
    <a
      href={`${url}#page=${citation.page_number}`}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {inner}
    </a>
  );
}
