"use client";
import { ArrowRight } from "lucide-react";
import { useRef, useState } from "react";

export function ChatInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  function send() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm focus-within:border-brand">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
          }}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Ask about Daikin products, configuration, troubleshooting…"
          className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
          disabled={disabled}
        />
        <button
          onClick={send}
          disabled={disabled || !value.trim()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          aria-label="Send"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 text-center text-[11px] text-slate-400">
        Powered by RAG · Responses grounded in Daikin technical documentation
      </div>
    </div>
  );
}
