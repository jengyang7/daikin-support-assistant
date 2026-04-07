import { NextRequest } from "next/server";
import { z } from "zod";
import { retrieve } from "@/lib/rag/retrieve";
import { buildPrompt, SYSTEM_PROMPT } from "@/lib/rag/prompt";
import { streamGenerate } from "@/lib/gemini";
import type { Citation } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  question: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .default([]),
  product: z
    .enum(["reiri_home", "reiri_office", "reiri_hotel"])
    .nullable()
    .optional(),
});

/**
 * POST /api/chat
 *
 * Streams a Gemini-generated answer as plain text chunks via a ReadableStream.
 * The final chunk before [DONE] is a JSON-encoded citation envelope:
 *
 *   data: <text delta>
 *   data: <text delta>
 *   ...
 *   event: citations
 *   data: {"citations":[{"index":1,"document_id":"...","title":"...","page_number":3}]}
 *   event: done
 *
 * The client uses a simple SSE parser; we keep the format minimal so we don't
 * pull in a streaming SDK.
 */
export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: String(err) }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const { question, history, product } = parsed;

  // 1. Retrieval
  let chunks;
  try {
    chunks = await retrieve({
      query: question,
      product: product ?? null,
      matchCount: 6,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Retrieval failed", details: String(err) }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  // Build citation list now — order matches [^n] markers in the prompt.
  const citations: Citation[] = chunks.map((c, i) => ({
    index: i + 1,
    document_id: c.document_id,
    title: c.title,
    page_number: c.page_number,
  }));

  const prompt = buildPrompt({
    history: history.map((m, i) => ({
      id: `h-${i}`,
      role: m.role,
      content: m.content,
      createdAt: 0,
    })),
    question,
    chunks,
  });

  // Dev-only: log the full prompt + retrieved chunks so you can evaluate quality.
  if (process.env.NODE_ENV === "development") {
    console.log("\n" + "═".repeat(72));
    console.log("📨 PROMPT SENT TO GEMINI");
    console.log("═".repeat(72));
    console.log("[System instruction]");
    console.log(SYSTEM_PROMPT);
    console.log("\n[Retrieved chunks]");
    chunks.forEach((c, i) =>
      console.log(
        `  [${i + 1}] ${c.title} p.${c.page_number} (sim=${c.similarity.toFixed(3)})\n      ${c.content.slice(0, 120).replace(/\n/g, " ")}…`,
      ),
    );
    console.log("\n[User prompt]");
    console.log(prompt);
    console.log("═".repeat(72) + "\n");
  }

  // 2. Stream generation as SSE.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of streamGenerate({
          systemInstruction: SYSTEM_PROMPT,
          prompt,
        })) {
          controller.enqueue(encoder.encode(`data: ${escapeSseData(delta)}\n\n`));
        }
        controller.enqueue(
          encoder.encode(
            `event: citations\ndata: ${JSON.stringify({ citations })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      } catch (err) {
        console.error("[/api/chat] stream error:", err);
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

// SSE `data:` lines must not contain raw newlines — split into multiple data lines.
function escapeSseData(s: string): string {
  return s.split("\n").join("\ndata: ");
}
