"use client";
import type { Conversation, ChatMessage, Product } from "@/types";

const STORAGE_KEY = "reiri-conversations-v1";
const MAX_CONVERSATIONS = 50;
const DEFAULT_TITLE = "New conversation";
const LEADING_FILLER =
  /^(how to|how do i|how can i|what is|what are|show me|show|can you|could you|please|help me)\s+/i;
const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function isEmptyConversation(conversation: Conversation): boolean {
  return conversation.messages.length === 0;
}

export function deriveConversationTitle(content: string): string {
  const cleaned = content
    .replace(/\s+/g, " ")
    .replace(/[^\w\s/-]+/g, " ")
    .replace(/\bset\s+up\b/gi, "setup")
    .replace(/\blog\s+in\b/gi, "login")
    .replace(LEADING_FILLER, "")
    .trim();

  if (!cleaned) return DEFAULT_TITLE;

  const words = cleaned.split(" ").filter(Boolean);
  const shortened = words
    .filter((word, index) => index < 5 || !TITLE_STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 6);

  const summary = shortened
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && TITLE_STOP_WORDS.has(lower)) return lower;
      if (/[A-Z]/.test(word.slice(1)) || /\d/.test(word)) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");

  return summary.slice(0, 42).trim() || DEFAULT_TITLE;
}

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

export function createConversation(productFilter: Product[] = []): Conversation {
  const now = Date.now();
  const list = safeRead();
  const reusable = list
    .filter(isEmptyConversation)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  if (reusable) {
    const updated = {
      ...reusable,
      productFilter,
      updatedAt: now,
    };
    const idx = list.findIndex((c) => c.id === reusable.id);
    list[idx] = updated;
    safeWrite(list);
    return updated;
  }

  const conv: Conversation = {
    id: cryptoRandomId(),
    title: DEFAULT_TITLE,
    messages: [],
    productFilter,
    createdAt: now,
    updatedAt: now,
  };
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

export function renameConversation(id: string, title: string) {
  const nextTitle = title.trim();
  if (!nextTitle) return;

  const list = safeRead();
  const conv = list.find((item) => item.id === id);
  if (!conv) return;
  conv.title = nextTitle;
  conv.updatedAt = Date.now();
  safeWrite(list);
}

export function appendMessage(convId: string, message: ChatMessage) {
  const list = safeRead();
  const idx = list.findIndex((c) => c.id === convId);
  if (idx < 0) return;
  list[idx].messages.push(message);
  list[idx].updatedAt = Date.now();
  // Auto-title from first user message.
  if (
    list[idx].title === DEFAULT_TITLE &&
    message.role === "user" &&
    message.content.trim().length > 0
  ) {
    list[idx].title = deriveConversationTitle(message.content);
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
