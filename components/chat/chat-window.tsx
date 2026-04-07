"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Snowflake } from "lucide-react";
import { ProductFilter } from "./product-filter";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { SourceDrawer } from "./source-drawer";
import { SourceContext } from "./source-context";
import {
  appendMessage,
  createConversation,
  cryptoRandomId,
  getConversation,
  saveConversation,
  updateMessage,
} from "@/lib/chat-history";
import { useDocumentUrls } from "./use-document-urls";
import type { ChatMessage, Citation, Conversation, Product } from "@/types";

export function ChatWindow() {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  // URL map for the drawer's "Open PDF" link.
  const allCitations = conv?.messages.flatMap((m) => m.citations ?? []) ?? [];
  const urlMap = useDocumentUrls(allCitations);

  // Load active conversation (or create one) on mount + when sidebar changes it.
  useEffect(() => {
    const load = () => {
      const id = window.localStorage.getItem("reiri-active-conversation");
      if (id) {
        const c = getConversation(id);
        if (c) {
          setConv(c);
          return;
        }
      }
      const fresh = createConversation(null);
      window.localStorage.setItem("reiri-active-conversation", fresh.id);
      window.dispatchEvent(new Event("reiri:active-changed"));
      window.dispatchEvent(new Event("reiri:history-changed"));
      setConv(fresh);
    };
    load();
    window.addEventListener("reiri:active-changed", load);
    return () => window.removeEventListener("reiri:active-changed", load);
  }, []);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [conv?.messages.length, conv?.messages[conv.messages.length - 1]?.content]);

  function setProductFilter(next: Product | null) {
    if (!conv) return;
    const updated = { ...conv, productFilter: next };
    setConv(updated);
    saveConversation(updated);
    window.dispatchEvent(new Event("reiri:history-changed"));
  }

  const openSource = useCallback((citation: Citation) => {
    setOpenCitation(citation);
  }, []);

  async function handleSend(text: string) {
    if (!conv || streaming) return;

    setLastQuery(text);

    const userMsg: ChatMessage = {
      id: cryptoRandomId(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    const assistantMsg: ChatMessage = {
      id: cryptoRandomId(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    // Optimistic UI update + persistence.
    const next: Conversation = {
      ...conv,
      messages: [...conv.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
    };
    setConv(next);
    appendMessage(conv.id, userMsg);
    appendMessage(conv.id, assistantMsg);
    window.dispatchEvent(new Event("reiri:history-changed"));

    setStreaming(true);
    try {
      const history = conv.messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: text,
          history,
          product: conv.productFilter,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Chat request failed: ${res.status}`);
      }

      // Streaming SSE parse loop.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let answer = "";
      let citations: Citation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nlnl: number;
        while ((nlnl = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, nlnl);
          buf = buf.slice(nlnl + 2);
          // parse frame
          const lines = frame.split("\n");
          let dataLines: string[] = [];
          let frameEvent = "message";
          for (const ln of lines) {
            if (ln.startsWith("event: ")) frameEvent = ln.slice(7);
            else if (ln.startsWith("data: ")) dataLines.push(ln.slice(6));
          }
          const dataStr = dataLines.join("\n");

          if (frameEvent === "message") {
            answer += dataStr;
            updateLast(answer, citations);
          } else if (frameEvent === "citations") {
            try {
              const parsed = JSON.parse(dataStr);
              citations = parsed.citations ?? [];
              updateLast(answer, citations);
            } catch {}
          } else if (frameEvent === "debug") {
            try {
              const debugPayload = JSON.parse(dataStr);
              // Persist debug info on the assistant message.
              updateMessage(conv.id, assistantMsg.id, { debug: debugPayload });
              setConv((prev) => {
                if (!prev) return prev;
                const msgs = prev.messages.slice();
                msgs[msgs.length - 1] = {
                  ...msgs[msgs.length - 1],
                  debug: debugPayload,
                };
                return { ...prev, messages: msgs };
              });
            } catch {}
          } else if (frameEvent === "done") {
            // final flush already done
          } else if (frameEvent === "error") {
            try {
              const parsed = JSON.parse(dataStr);
              answer += `\n\n*Error: ${parsed.message}*`;
            } catch {
              answer += `\n\n*An error occurred while generating the response.*`;
            }
            updateLast(answer, citations);
          }
        }
      }

      // Persist final assistant message.
      updateMessage(conv.id, assistantMsg.id, {
        content: answer,
        citations,
      });
      window.dispatchEvent(new Event("reiri:history-changed"));
    } catch (err) {
      console.error(err);
      updateLast(
        "Sorry, something went wrong contacting the assistant. Please try again.",
        [],
      );
      updateMessage(conv.id, assistantMsg.id, {
        content:
          "Sorry, something went wrong contacting the assistant. Please try again.",
      });
    } finally {
      setStreaming(false);
    }

    function updateLast(content: string, citations: Citation[]) {
      setConv((prev) => {
        if (!prev) return prev;
        const msgs = prev.messages.slice();
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content,
          citations,
        };
        return { ...prev, messages: msgs };
      });
    }
  }

  if (!conv) {
    return <div className="flex flex-1 items-center justify-center text-slate-400">Loading…</div>;
  }

  const isEmpty = conv.messages.length === 0;
  const drawerUrl = openCitation ? (urlMap.get(openCitation.document_id) ?? null) : null;

  return (
    <SourceContext.Provider value={openSource}>
      <div className="flex h-full flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="text-[15px] font-semibold text-slate-800">
              Daikin Technical Support
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Online
            </div>
          </div>
          <ProductFilter value={conv.productFilter} onChange={setProductFilter} />
        </header>

        {/* Messages */}
        <div ref={scrollerRef} className="scroll-thin flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-4xl space-y-5">
            {isEmpty && <EmptyState />}
            {conv.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        </div>

        {/* Composer */}
        <ChatInput onSubmit={handleSend} disabled={streaming} />
      </div>

      {/* Source drawer — rendered outside the scrollable area */}
      <SourceDrawer
        citation={openCitation}
        query={lastQuery}
        url={drawerUrl}
        onClose={() => setOpenCitation(null)}
      />
    </SourceContext.Provider>
  );
}

function EmptyState() {
  const examples = [
    "What is Reiri and what systems does it support?",
    "How do I configure WsCloud relay for remote access?",
    "List the Reiri error codes for thermistor failures",
  ];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
        <Snowflake className="h-6 w-6" strokeWidth={2.5} />
      </div>
      <h2 className="text-xl font-semibold text-slate-800">
        How can I help with your Daikin system?
      </h2>
      <p className="mt-1 text-[14px] text-slate-500">
        Ask me anything about Daikin products, configuration, or troubleshooting.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {examples.map((ex) => (
          <span
            key={ex}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-600"
          >
            {ex}
          </span>
        ))}
      </div>
    </div>
  );
}
