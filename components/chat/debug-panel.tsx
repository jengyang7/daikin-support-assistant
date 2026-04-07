"use client";
import { useState } from "react";
import { Bug, ChevronDown, ChevronRight, Copy } from "lucide-react";
import type { ChatMessage } from "@/types";
import { useDebugMode } from "@/lib/debug-mode";

export function DebugPanel({ message }: { message: ChatMessage }) {
  const debugOn = useDebugMode();
  const [open, setOpen] = useState(false);
  const [sysOpen, setSysOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!debugOn || !message.debug) return null;

  const { systemInstruction, userPrompt, chunks } = message.debug;

  function copyPrompt() {
    navigator.clipboard.writeText(
      `[System]\n${systemInstruction}\n\n[User]\n${userPrompt}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 text-[12px]">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-amber-700 hover:bg-amber-100/60"
      >
        <Bug className="h-3.5 w-3.5" />
        <span className="font-semibold">Debug</span>
        <span className="ml-1 text-amber-500">
          {chunks.length} chunks retrieved
        </span>
        <span className="ml-auto">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-amber-200 px-3 py-3 space-y-3">
          {/* Retrieved chunks */}
          <div>
            <div className="mb-1.5 font-semibold text-amber-700 uppercase tracking-wider text-[10px]">
              Retrieved Chunks
            </div>
            <div className="space-y-2">
              {chunks.map((c, i) => (
                <div
                  key={c.chunk_id}
                  className="rounded-md border border-amber-100 bg-white p-2.5"
                >
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="font-medium text-slate-700">
                      [{i + 1}] {c.title} p.{c.page_number}
                    </span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      sim {c.similarity.toFixed(3)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      rrf {c.rrf_score.toFixed(4)}
                    </span>
                    {c.vector_rank !== null && (
                      <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
                        vec #{c.vector_rank}
                      </span>
                    )}
                    {c.keyword_rank !== null && (
                      <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] text-green-600">
                        kw #{c.keyword_rank}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">
                    {c.content.slice(0, 200)}
                    {c.content.length > 200 ? "…" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System instruction */}
          <div>
            <button
              onClick={() => setSysOpen((v) => !v)}
              className="flex items-center gap-1 font-semibold text-amber-700 uppercase tracking-wider text-[10px] hover:text-amber-800"
            >
              {sysOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              System Instruction
            </button>
            {sysOpen && (
              <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-amber-100 bg-white p-2.5 text-[11px] text-slate-600 leading-relaxed">
                {systemInstruction}
              </pre>
            )}
          </div>

          {/* User prompt */}
          <div>
            <button
              onClick={() => setPromptOpen((v) => !v)}
              className="flex items-center gap-1 font-semibold text-amber-700 uppercase tracking-wider text-[10px] hover:text-amber-800"
            >
              {promptOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              User Prompt
            </button>
            {promptOpen && (
              <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-amber-100 bg-white p-2.5 text-[11px] text-slate-600 leading-relaxed">
                {userPrompt}
              </pre>
            )}
          </div>

          {/* Copy button */}
          <button
            onClick={copyPrompt}
            className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50"
          >
            <Copy className="h-3 w-3" />
            {copied ? "Copied!" : "Copy full prompt"}
          </button>
        </div>
      )}
    </div>
  );
}
