"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, FileText, Bug } from "lucide-react";
import { isValidElement, useContext, type ReactNode } from "react";
import { shouldSuppressSources } from "@/lib/chat-response";
import { cn } from "@/lib/utils";
import type { ChatMessage, Citation } from "@/types";
import { SourceContext } from "./source-context";
import { useDebugMode } from "@/lib/debug-mode";

function replaceInlineCitations(text: string, citationByIndex: Map<number, Citation>): string {
  return text.replace(/\[(?:\^)?(\d+)\]/g, (_, rawIndex: string) => {
    const index = Number(rawIndex);
    const citation = citationByIndex.get(index);
    if (!citation) return `[^${index}]`;
    return `[p.${citation.page_number}](citation://${index})`;
  });
}

function deduplicateCitations(
  citations: Citation[],
): Array<{ citation: Citation; pages: number[] }> {
  const map = new Map<string, { citation: Citation; pages: Set<number> }>();
  for (const c of citations) {
    if (!map.has(c.document_id)) {
      map.set(c.document_id, { citation: c, pages: new Set([c.page_number]) });
    } else {
      map.get(c.document_id)!.pages.add(c.page_number);
    }
  }
  return Array.from(map.values()).map(({ citation, pages }) => ({
    citation,
    pages: Array.from(pages).sort((a, b) => a - b),
  }));
}

function getNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return getNodeText(node.props.children);
  return "";
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { openPdf, openDebug } = useContext(SourceContext);
  const debugOn = useDebugMode();

  if (message.role === "user") {
    return (
      <div className="flex animate-fade-in flex-col items-end">
        <div className="flex w-full justify-end gap-2.5">
          <div className="w-fit max-w-[82%] flex-shrink-0 whitespace-normal break-words rounded-2xl bg-bubble-user px-6 py-3 text-[15px] text-white shadow-sm">
            {message.content}
          </div>
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm">
            <User className="h-5 w-5" />
          </div>
        </div>
      </div>
    );
  }

  const citations = shouldSuppressSources(message.content) ? [] : message.citations ?? [];
  const deduped = deduplicateCitations(citations);
  const citationByIndex = new Map(citations.map((c) => [c.index, c]));
  const processed = replaceInlineCitations(message.content, citationByIndex);
  const isTyping = message.content.length === 0;

  return (
    <div className="flex animate-fade-in items-start gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-500 shadow-sm">
        <Bot className="h-5 w-5" />
      </div>
      <div className={cn("max-w-[85%]", isTyping ? "" : "flex-1")}>
        <div
          className={cn(
            "rounded-2xl border border-slate-100 bg-white shadow-sm",
            isTyping ? "inline-flex items-center px-4 py-3" : "px-5 py-4",
          )}
        >
          <div className="prose-chat">
            {isTyping ? (
              <TypingDots />
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ href, children, ...props }) {
                    const childText = getNodeText(children).trim();
                    const hrefMatch = href?.match(/(\d+)$/);
                    const pageMatch = childText.match(/p\.(\d+)/);
                    const idx = hrefMatch ? parseInt(hrefMatch[1], 10) : null;

                    if (href?.startsWith("citation://") || pageMatch) {
                      const citation =
                        (idx !== null ? citationByIndex.get(idx) : undefined) ??
                        citations.find((item) => item.page_number === Number(pageMatch?.[1]));

                      return <InlineCitation citation={citation} onOpen={openPdf} fallbackLabel={childText} />;
                    }
                    return (
                      <a href={href} {...props}>
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {processed}
              </ReactMarkdown>
            )}
          </div>

          {/* Sources — deduplicated full-width rows */}
          {deduped.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Sources
              </div>
              <div className="space-y-1.5">
                {deduped.map(({ citation, pages }) => {
                  return (
                    <SourceRow
                      key={citation.document_id}
                      citation={citation}
                      pages={pages}
                      onOpen={openPdf}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Debug trigger */}
        {debugOn && message.debug && (
          <div className="mt-1.5 flex justify-start">
            <button
              onClick={() => openDebug(message.id)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-100 transition"
            >
              <Bug className="h-3.5 w-3.5" />
              Debug — {message.debug.chunks.length} chunks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InlineCitation({
  citation,
  onOpen,
  fallbackLabel,
}: {
  citation?: Citation;
  onOpen: (citation: Citation) => void;
  fallbackLabel?: string;
}) {
  if (!citation) {
    return (
      <span className="mx-0.5 inline-flex align-super">
        <span className="inline-flex items-center justify-center rounded-full border border-brand/20 bg-brand/10 px-2 py-1 text-[11px] font-semibold leading-none text-brand">
          {fallbackLabel || "Source"}
        </span>
      </span>
    );
  }

  return (
    <span
      className="mx-0.5 inline-flex text-[11px] leading-none"
      style={{ verticalAlign: "super" }}
    >
      <button
        onClick={() => onOpen(citation)}
        className="inline-flex items-center justify-center rounded-full border border-brand/20 bg-brand/10 px-2 py-1 font-semibold text-brand transition hover:border-brand/35 hover:bg-brand/15"
      >
        {`p.${citation.page_number}`}
      </button>
    </span>
  );
}

function SourceRow({
  citation,
  pages,
  onOpen,
}: {
  citation: Citation;
  pages: number[];
  onOpen: (citation: Citation) => void;
}) {
  return (
    <button
      onClick={() => onOpen(citation)}
      className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-brand/40 hover:bg-brand-light"
    >
      <FileText className="h-4 w-4 flex-shrink-0 text-brand" />
      <span className="flex-1 truncate text-[13px] font-medium text-slate-700">
        {citation.title}
      </span>
      <span className="flex-shrink-0 text-[11px] text-slate-400">
        pp.&nbsp;{pages.join(", ")}
      </span>
    </button>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="h-2 w-2 animate-pulse-dot rounded-full bg-brand/40 [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-pulse-dot rounded-full bg-brand/40 [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-pulse-dot rounded-full bg-brand/40 [animation-delay:300ms]" />
    </div>
  );
}
