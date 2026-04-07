"use client";
import type { Conversation, ChatMessage, Product } from "@/types";

const STORAGE_KEY = "reiri-conversations-v1";
const MAX_CONVERSATIONS = 50;

function safeRead(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function safeWrite(list: Conversation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(list.slice(0, MAX_CONVERSATIONS)),
    );
  } catch {
    // ignore quota errors
  }
}

export function listConversations(): Conversation[] {
  return safeRead().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | null {
  return safeRead().find((c) => c.id === id) ?? null;
}

export function createConversation(productFilter: Product | null = null): Conversation {
  const now = Date.now();
  const conv: Conversation = {
    id: cryptoRandomId(),
    title: "New conversation",
    messages: [],
    productFilter,
    createdAt: now,
    updatedAt: now,
  };
  const list = safeRead();
  list.unshift(conv);
  safeWrite(list);
  return conv;
}

export function saveConversation(conv: Conversation) {
  const list = safeRead();
  const idx = list.findIndex((c) => c.id === conv.id);
  const updated = { ...conv, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = updated;
  else list.unshift(updated);
  safeWrite(list);
}

export function deleteConversation(id: string) {
  safeWrite(safeRead().filter((c) => c.id !== id));
}

export function appendMessage(convId: string, message: ChatMessage) {
  const list = safeRead();
  const idx = list.findIndex((c) => c.id === convId);
  if (idx < 0) return;
  list[idx].messages.push(message);
  list[idx].updatedAt = Date.now();
  // Auto-title from first user message.
  if (
    list[idx].title === "New conversation" &&
    message.role === "user" &&
    message.content.trim().length > 0
  ) {
    list[idx].title = message.content.trim().slice(0, 60);
  }
  safeWrite(list);
}

export function updateMessage(convId: string, messageId: string, patch: Partial<ChatMessage>) {
  const list = safeRead();
  const conv = list.find((c) => c.id === convId);
  if (!conv) return;
  const m = conv.messages.find((x) => x.id === messageId);
  if (!m) return;
  Object.assign(m, patch);
  conv.updatedAt = Date.now();
  safeWrite(list);
}

export function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
