"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Snowflake } from "lucide-react";
import type { ChatMessage } from "@/types";
import { SourceChip } from "./source-chip";
import { useDocumentUrls } from "./use-document-urls";

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex animate-fade-in justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-bubble-user px-4 py-2.5 text-[15px] text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // Strip [^n] markers from the displayed text — we render them as chips below.
  const cleaned = message.content.replace(/\[\^(\d+)\]/g, "");
  const urls = useDocumentUrls(message.citations ?? []);

  return (
    <div className="flex animate-fade-in items-start gap-2.5">
      <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-brand text-white">
        <Snowflake className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-bubble-assistant px-4 py-3 shadow-sm">
        <div className="prose-chat">
          {message.content.length === 0 ? (
            <TypingDots />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleaned}</ReactMarkdown>
          )}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2.5">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Sources
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((c) => (
                <SourceChip
                  key={c.index}
                  citation={c}
                  url={urls.get(c.document_id) ?? null}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-slate-400 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-slate-400 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-slate-400 [animation-delay:300ms]" />
    </div>
  );
}
