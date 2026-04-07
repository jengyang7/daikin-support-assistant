"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageSquare, FileText, Plus, Snowflake, Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createConversation,
  deleteConversation,
  listConversations,
} from "@/lib/chat-history";
import { getDebugMode, setDebugMode, useDebugMode } from "@/lib/debug-mode";
import type { Conversation } from "@/types";

export function Sidebar() {
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const debugOn = useDebugMode();

  // Load + subscribe to history changes (custom event fired by chat page).
  useEffect(() => {
    const refresh = () => setConversations(listConversations());
    refresh();
    window.addEventListener("reiri:history-changed", refresh);
    return () => window.removeEventListener("reiri:history-changed", refresh);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.localStorage.getItem("reiri-active-conversation");
    setActiveId(id);
    const onActive = () =>
      setActiveId(window.localStorage.getItem("reiri-active-conversation"));
    window.addEventListener("reiri:active-changed", onActive);
    return () => window.removeEventListener("reiri:active-changed", onActive);
  }, []);

  function handleNew() {
    const c = createConversation(null);
    window.localStorage.setItem("reiri-active-conversation", c.id);
    window.dispatchEvent(new Event("reiri:history-changed"));
    window.dispatchEvent(new Event("reiri:active-changed"));
    if (pathname !== "/chat") window.location.href = "/chat";
  }

  function handleSelect(id: string) {
    window.localStorage.setItem("reiri-active-conversation", id);
    window.dispatchEvent(new Event("reiri:active-changed"));
    if (pathname !== "/chat") window.location.href = "/chat";
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteConversation(id);
    if (activeId === id) {
      window.localStorage.removeItem("reiri-active-conversation");
      window.dispatchEvent(new Event("reiri:active-changed"));
    }
    window.dispatchEvent(new Event("reiri:history-changed"));
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-slate-100">
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
          <Snowflake className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[15px] font-semibold leading-tight">
            Daikin Support
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Assistant · RAG-Powered
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 pt-3">
        <Link
          href="/chat"
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[13px] font-medium transition",
            pathname === "/chat"
              ? "bg-sidebar-active text-white"
              : "text-slate-300 hover:bg-sidebar-hover",
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Chat
        </Link>
        <Link
          href="/documents"
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[13px] font-medium transition",
            pathname === "/documents"
              ? "bg-sidebar-active text-white"
              : "text-slate-300 hover:bg-sidebar-hover",
          )}
        >
          <FileText className="h-4 w-4" />
          Documents
        </Link>
      </div>

      {/* New conversation */}
      <button
        onClick={handleNew}
        className="mx-3 mt-3 flex items-center justify-center gap-1.5 rounded-md border border-sidebar-border bg-transparent px-3 py-2 text-[13px] font-medium text-slate-200 transition hover:bg-sidebar-hover"
      >
        <Plus className="h-4 w-4" />
        New Conversation
      </button>

      {/* Recent */}
      <div className="mt-5 px-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Recent
      </div>
      <div className="scroll-thin scroll-thin-dark mt-1 flex-1 overflow-y-auto px-2">
        {conversations.length === 0 && (
          <div className="px-3 py-2 text-[12px] text-slate-500">No conversations yet</div>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelect(c.id)}
            className={cn(
              "group mb-0.5 flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-[13px] transition",
              activeId === c.id
                ? "bg-sidebar-active text-white"
                : "text-slate-300 hover:bg-sidebar-hover",
            )}
          >
            <span className="truncate">{c.title}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => handleDelete(e, c.id)}
              className="ml-2 hidden text-slate-500 hover:text-slate-200 group-hover:inline"
              aria-label="Delete conversation"
            >
              ×
            </span>
          </button>
        ))}
      </div>

      {/* Footer: knowledge base labels + debug toggle */}
      <div className="border-t border-sidebar-border px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500">
        Knowledge Base
        <div className="mt-1 flex gap-3 text-[11px] font-medium normal-case tracking-normal text-slate-300">
          <span>Catalogue</span>
          <span>Datasheet</span>
          <span>Manuals</span>
        </div>
      </div>

      {/* Developer debug toggle */}
      <div className="border-t border-sidebar-border px-4 py-2.5">
        <button
          onClick={() => setDebugMode(!debugOn)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition",
            debugOn
              ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
              : "text-slate-500 hover:bg-sidebar-hover hover:text-slate-300",
          )}
        >
          <Bug className="h-3.5 w-3.5" />
          Debug mode
          <span
            className={cn(
              "ml-auto h-3.5 w-6 rounded-full transition-colors",
              debugOn ? "bg-amber-400" : "bg-slate-600",
            )}
          />
        </button>
      </div>
    </aside>
  );
}
