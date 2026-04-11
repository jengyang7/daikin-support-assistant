"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Plus,
  Bug,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
} from "@/lib/chat-history";
import { setDebugMode, useDebugMode } from "@/lib/debug-mode";
import type { Conversation } from "@/types";

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debugOn = useDebugMode();

  useEffect(() => {
    const refresh = () =>
      setConversations(listConversations().filter((conversation) => conversation.messages.length > 0));
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

  useEffect(() => {
    if (!menuOpenId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-conversation-actions='true']")) return;
      setMenuOpenId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpenId(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpenId]);

  useEffect(() => {
    if (!editingId) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingId]);

  function handleNew() {
    const c = createConversation([]);
    window.localStorage.setItem("reiri-active-conversation", c.id);
    window.dispatchEvent(new Event("reiri:history-changed"));
    window.dispatchEvent(new Event("reiri:active-changed"));
    onClose?.();
    if (pathname !== "/chat") window.location.href = "/chat";
  }

  function handleSelect(id: string) {
    setMenuOpenId(null);
    window.localStorage.setItem("reiri-active-conversation", id);
    window.dispatchEvent(new Event("reiri:active-changed"));
    onClose?.();
    if (pathname !== "/chat") window.location.href = "/chat";
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setMenuOpenId(null);
    setEditingId(null);
    deleteConversation(id);
    if (activeId === id) {
      window.localStorage.removeItem("reiri-active-conversation");
      window.dispatchEvent(new Event("reiri:active-changed"));
    }
    window.dispatchEvent(new Event("reiri:history-changed"));
  }

  function handleRename(e: React.MouseEvent, conversation: Conversation) {
    e.stopPropagation();
    setMenuOpenId(null);
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
  }

  function commitRename(id: string) {
    const existing = conversations.find((conversation) => conversation.id === id);
    setEditingId(null);
    if (!existing) return;

    const nextTitle = editingTitle.trim();
    setEditingTitle("");
    if (!nextTitle || nextTitle === existing.title) return;

    renameConversation(id, nextTitle);
    window.dispatchEvent(new Event("reiri:history-changed"));
    if (activeId === id) window.dispatchEvent(new Event("reiri:active-changed"));
  }

  function cancelRename() {
    setEditingId(null);
    setEditingTitle("");
  }

  return (
    <aside className="flex h-full w-[230px] flex-shrink-0 flex-col border-r border-slate-200 bg-white xl:w-[260px] 2xl:w-[300px]">
      {/* Brand */}
      <div className="flex items-start justify-between px-5 pt-6 pb-7">
        <div>
          <div className="text-[20px] font-extrabold text-brand leading-tight">
            Daikin Technical Support
          </div>
          <div className="mt-0.5 text-[12px] font-semibold uppercase tracking-widest text-slate-400">
            Powered by Gemini AI
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* New chat button */}
      <div className="px-4 pb-4">
        <button
          onClick={handleNew}
          className="flex w-full items-center justify-start gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New Chat
        </button>
      </div>

      {/* Navigation */}
      <div className="px-4 pb-2">
        <Link
          href="/documents"
          onClick={() => onClose?.()}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition",
            pathname === "/documents"
              ? "bg-brand-light text-brand font-semibold"
              : "text-slate-600 hover:bg-sidebar-hover hover:text-brand",
          )}
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          Documents
        </Link>
      </div>

      {/* Recent chats */}
      <div className="mt-2 flex-1 overflow-y-auto px-4 scroll-thin">
        <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Recent Chats
        </div>
        {conversations.length === 0 && (
          <div className="px-3 py-2 text-[12px] text-slate-400">
            No conversations yet
          </div>
        )}
        {conversations.map((c) => {
          // Only highlight active conversation when on the chat page
          const isActive = activeId === c.id && pathname === "/chat";
          const isEditing = editingId === c.id;
          return (
            <div
              key={c.id}
              className="group relative mb-0.5"
            >
              <div
                className={cn(
                  "flex w-full items-center rounded-lg px-3 py-2 pr-10 text-left text-[13px] font-medium transition",
                  isActive
                    ? "bg-brand-light text-brand font-semibold"
                    : "text-slate-600 hover:bg-sidebar-hover hover:text-brand",
                )}
              >
                {isEditing ? (
                  <input
                    ref={inputRef}
                    data-conversation-actions="true"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => commitRename(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(c.id);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                    className="min-w-0 flex-1 rounded bg-white/90 px-2 py-1 text-[13px] font-medium text-slate-700 outline-none ring-1 ring-brand/30"
                  />
                ) : (
                  <button
                    onClick={() => handleSelect(c.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate">{c.title}</span>
                  </button>
                )}
              </div>
              <button
                data-conversation-actions="true"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId((prev) => (prev === c.id ? null : c.id));
                }}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-300 transition hover:bg-white hover:text-slate-500",
                  isEditing ? "hidden" : menuOpenId === c.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                aria-label="Conversation actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpenId === c.id && (
                <div
                  data-conversation-actions="true"
                  className="absolute right-2 top-[calc(100%+4px)] z-20 min-w-[144px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-200/80"
                >
                  <button
                    onClick={(e) => handleRename(e, c)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rename
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, c.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 px-4 py-3 space-y-0.5">
        <button
          onClick={() => setDebugMode(!debugOn)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition",
            debugOn
              ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
              : "text-slate-500 hover:bg-sidebar-hover hover:text-brand",
          )}
        >
          <Bug className="h-4 w-4" />
          Debug mode
          {debugOn && (
            <span className="ml-auto rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
              ON
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
