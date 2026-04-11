"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot } from "lucide-react";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { DebugDrawer } from "./debug-drawer";
import { SourceContext } from "./source-context";
import { PageSpinner } from "@/components/ui/loading-spinner";
import { shouldSuppressSources } from "@/lib/chat-response";
import {
  appendMessage,
  createConversation,
  cryptoRandomId,
  deriveConversationTitle,
  getConversation,
  saveConversation,
  updateMessage,
} from "@/lib/chat-history";
import { useDocumentUrls } from "./use-document-urls";
import { type AttachedImage } from "@/lib/images";
import type { ChatMessage, Citation, Conversation, Product } from "@/types";

export function ChatWindow() {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [debugMsgId, setDebugMsgId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const allCitations = conv?.messages.flatMap((m) => m.citations ?? []) ?? [];
  const urlMap = useDocumentUrls(allCitations);

  useEffect(() => {
    const load = () => {
      const id = window.localStorage.getItem("reiri-active-conversation");
      if (id) {
        const c = getConversation(id);
        if (c) { setConv(c); return; }
      }
      const fresh = createConversation([]);
      window.localStorage.setItem("reiri-active-conversation", fresh.id);
      window.dispatchEvent(new Event("reiri:active-changed"));
      window.dispatchEvent(new Event("reiri:history-changed"));
      setConv(fresh);
    };
    load();
    window.addEventListener("reiri:active-changed", load);
    return () => window.removeEventListener("reiri:active-changed", load);
  }, []);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [conv?.messages.length, conv?.messages[conv.messages.length - 1]?.content]);

  function setProductFilter(next: Product[]) {
    if (!conv) return;
    const updated = { ...conv, productFilter: next };
    setConv(updated);
    saveConversation(updated);
    window.dispatchEvent(new Event("reiri:history-changed"));
  }

  const openPdf = useCallback((citation: Citation) => {
    const url = urlMap.get(citation.document_id);
    if (url) window.open(`${url}#page=${citation.page_number}`, "_blank", "noreferrer");
  }, [urlMap]);

  const openDebug = useCallback((messageId: string) => {
    setDebugMsgId(messageId);
  }, []);

  const debugMessage = conv?.messages.find((m) => m.id === debugMsgId) ?? null;

  async function handleSend(text: string) {
    if (!conv || streaming) return;

    const imagePayload = attachedImages.map(({ mimeType, data }) => ({ mimeType, data }));
    const imageDataUrls = attachedImages.map(({ dataUrl }) => dataUrl);

    const userMsg: ChatMessage = {
      id: cryptoRandomId(),
      role: "user",
      content: text,
      images: imageDataUrls.length > 0 ? imageDataUrls : undefined,
      createdAt: Date.now(),
    };
    const assistantMsg: ChatMessage = {
      id: cryptoRandomId(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    const nextTitle =
      conv.title === "New conversation" ? deriveConversationTitle(text) : conv.title;

    const next: Conversation = {
      ...conv,
      title: nextTitle,
      messages: [...conv.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
    };
    setConv(next);
    appendMessage(conv.id, userMsg);
    appendMessage(conv.id, assistantMsg);
    window.dispatchEvent(new Event("reiri:history-changed"));

    setAttachedImages([]);
    setStreaming(true);
    try {
      const history = conv.messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: text,
          history,
          products: conv.productFilter ?? [],
          images: imagePayload.length > 0 ? imagePayload : undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Chat request failed: ${res.status}`);

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
              citations = JSON.parse(dataStr).citations ?? [];
              updateLast(answer, citations);
            } catch {}
          } else if (frameEvent === "debug") {
            try {
              const debugPayload = JSON.parse(dataStr);
              updateMessage(conv.id, assistantMsg.id, { debug: debugPayload });
              setConv((prev) => {
                if (!prev) return prev;
                const msgs = prev.messages.slice();
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], debug: debugPayload };
                return { ...prev, messages: msgs };
              });
            } catch {}
          } else if (frameEvent === "error") {
            try {
              answer += `\n\n*Error: ${JSON.parse(dataStr).message}*`;
            } catch {
              answer += `\n\n*An error occurred while generating the response.*`;
            }
            updateLast(answer, citations);
          }
        }
      }

      const finalCitations = shouldSuppressSources(answer) ? [] : citations;
      updateMessage(conv.id, assistantMsg.id, { content: answer, citations: finalCitations });
      window.dispatchEvent(new Event("reiri:history-changed"));
    } catch (err) {
      console.error(err);
      const errMsg = "Sorry, something went wrong contacting the assistant. Please try again.";
      updateLast(errMsg, []);
      updateMessage(conv.id, assistantMsg.id, { content: errMsg });
    } finally {
      setStreaming(false);
    }

    function updateLast(content: string, citations: Citation[]) {
      const visibleCitations = shouldSuppressSources(content) ? [] : citations;
      setConv((prev) => {
        if (!prev) return prev;
        const msgs = prev.messages.slice();
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content, citations: visibleCitations };
        return { ...prev, messages: msgs };
      });
    }
  }

  if (!conv) {
    return <PageSpinner />;
  }

  const isEmpty = conv.messages.length === 0;

  return (
    <SourceContext.Provider value={{ openPdf, openDebug, urlMap }}>
      <div className="relative flex h-full flex-1 flex-col bg-chatbg">
        {/* Top bar — desktop only (mobile has AppShell header) */}
        <header className="hidden md:flex items-center justify-between px-6 py-3">
          <div className="flex-1" />
          <div className="text-[14px] font-semibold text-slate-700">
            {isEmpty ? "" : conv.title}
          </div>
          <div className="flex-1" />
        </header>

        {isEmpty ? (
          <div className="flex flex-1 items-center justify-center px-3 pb-24 pt-6 sm:px-6">
            <div className="w-full max-w-3xl -translate-y-10">
              <EmptyState onExampleClick={setInputValue} />
              <ChatInput
                onSubmit={handleSend}
                disabled={streaming}
                products={conv.productFilter ?? []}
                onProductChange={setProductFilter}
                value={inputValue}
                onValueChange={setInputValue}
                images={attachedImages}
                onImagesChange={setAttachedImages}
                floating={false}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div ref={scrollerRef} className="scroll-thin flex-1 overflow-y-auto px-3 py-4 pb-36 sm:px-6 sm:py-6">
              <div className="mx-auto max-w-3xl space-y-6">
                {conv.messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </div>
            </div>

            {/* Gradient fade — masks chat content behind floating input */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-chatbg" />

            {/* Floating input */}
            <ChatInput
              onSubmit={handleSend}
              disabled={streaming}
              products={conv.productFilter ?? []}
              onProductChange={setProductFilter}
              value={inputValue}
              onValueChange={setInputValue}
              images={attachedImages}
              onImagesChange={setAttachedImages}
            />
          </>
        )}
      </div>

      {/* Debug drawer */}
      <DebugDrawer
        message={debugMessage}
        onClose={() => setDebugMsgId(null)}
      />
    </SourceContext.Provider>
  );
}

function EmptyState({ onExampleClick }: { onExampleClick: (text: string) => void }) {
  const examples = [
    "How to wire the adapter box to indoor units for Reiri?",
    "What are the specifications and supported protocols of Reiri Office?",
    "How to configure scheduling and temperature setpoints in Reiri?",
    "What are the system requirements for installing Reiri Home?",
  ];
  return (
    <div className="flex flex-col items-center justify-center pt-12 pb-4 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-500 shadow-sm">
        <Bot className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-bold text-slate-800">
        Hello. I am the Daikin Technical Support Assistant.
      </h2>
      <p className="mt-1 text-[14px] text-slate-500">
        Ask me anything about Daikin products, configuration, or troubleshooting.
      </p>
      {/* Suggestions hidden */}
    </div>
  );
}
