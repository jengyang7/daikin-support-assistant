"use client";
import { useEffect } from "react";
import { X, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import type { ChatMessage } from "@/types";

interface DebugDrawerProps {
  message: ChatMessage | null;
  onClose: () => void;
}

export function DebugDrawer({ message, onClose }: DebugDrawerProps) {
  const open = message !== null;
  const debug = message?.debug;

  const [sysOpen, setSysOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset collapsed state when a new message opens
  useEffect(() => {
    setSysOpen(false);
    setPromptOpen(false);
  }, [message?.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function copyPrompt() {
    if (!debug) return;
    navigator.clipboard.writeText(
      `[System]\n${debug.systemInstruction}\n\n[User]\n${debug.userPrompt}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-[460px] flex-col bg-white shadow-2xl transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {debug && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-[14px] font-semibold text-slate-800">Debug Info</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {debug.chunks.length} chunks retrieved
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Retrieved chunks */}
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Retrieved Chunks
                </div>
                <div className="space-y-2">
                  {debug.chunks.map((c, i) => (
                    <div
                      key={c.chunk_id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-[12px] font-semibold text-slate-700">
                          [{i + 1}] {c.title}
                        </span>
                        <span className="text-[11px] text-slate-400">p.{c.page_number}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        <Badge label="sim" value={c.similarity.toFixed(3)} />
                        <Badge label="rrf" value={c.rrf_score.toFixed(4)} />
                        {c.vector_rank !== null && (
                          <Badge label="vec" value={`#${c.vector_rank}`} color="blue" />
                        )}
                        {c.keyword_rank !== null && (
                          <Badge label="kw" value={`#${c.keyword_rank}`} color="green" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 leading-relaxed line-clamp-4">
                        {c.content.slice(0, 300)}{c.content.length > 300 ? "…" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System instruction */}
              <div>
                <button
                  onClick={() => setSysOpen((v) => !v)}
                  className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
                >
                  {sysOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  System Instruction
                </button>
                {sysOpen && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 leading-relaxed">
                    {debug.systemInstruction}
                  </pre>
                )}
              </div>

              {/* User prompt */}
              <div>
                <button
                  onClick={() => setPromptOpen((v) => !v)}
                  className="flex w-full items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600"
                >
                  {promptOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  User Prompt
                </button>
                {promptOpen && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 leading-relaxed">
                    {debug.userPrompt}
                  </pre>
                )}
              </div>
            </div>

            {/* Footer copy button */}
            <div className="border-t border-slate-100 px-5 py-3">
              <button
                onClick={copyPrompt}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy full prompt"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Badge({
  label,
  value,
  color = "slate",
}: {
  label: string;
  value: string;
  color?: "slate" | "blue" | "green";
}) {
  const colors = {
    slate: "bg-slate-100 text-slate-500",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
  };
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] ${colors[color]}`}>
      <span className="opacity-60">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
