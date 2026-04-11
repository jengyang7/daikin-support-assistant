import { NextRequest } from "next/server";
import { z } from "zod";
import { retrieve } from "@/lib/rag/retrieve";
import { buildPrompt, SYSTEM_PROMPT } from "@/lib/rag/prompt";
import { describeImages, streamGenerate } from "@/lib/gemini";
import type { Citation, Product, RetrievedChunk } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;
const SMALL_TALK_SYSTEM_PROMPT = `You are Daikin Technical Support Assistant.

For short greetings and conversational openers, reply warmly and briefly in plain prose.
- Do not use citations.
- Do not mention source documents.
- Keep the reply to one short paragraph.`;

const BodySchema = z.object({
  question: z.string().max(2000).default(""),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .default([]),
  products: z
    .array(z.enum(["reiri_home", "reiri_office", "reiri_hotel", "reiri_resort"]))
    .default([]),
  images: z
    .array(z.object({ mimeType: z.string(), data: z.string() }))
    .max(3)
    .optional(),
});

function isSmallTalkQuestion(question: string): boolean {
  const normalized = question
    .trim()
    .toLowerCase()
    .replace(/[!.?]+$/g, "")
    .replace(/\s+/g, " ");

  return /^(hi|hello|hello there|hey|hey there|good morning|good afternoon|good evening|thanks|thank you|ok|okay|yo|sup)$/.test(normalized);
}

/**
 * POST /api/chat
 *
 * Streams a Gemini-generated answer as SSE. Frame sequence:
 *
 *   data: <text delta>          (one or more)
 *   event: citations
 *   data: {"citations":[...]}
 *   event: debug
 *   data: {"systemInstruction":"...","userPrompt":"...","chunks":[...]}
 *   event: done
 *   data: {}
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

  const { question, history, products, images } = parsed;
  const hasImages = (images?.length ?? 0) > 0;
  const hasText = question.trim().length > 0;

  // Require at least text or images
  if (!hasText && !hasImages) {
    return new Response(
      JSON.stringify({ error: "Provide a question or attach an image." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const isSmallTalk = hasText && !hasImages && isSmallTalkQuestion(question);

  // 1. If images are present, ask Gemini to describe them first so we always
  //    have a meaningful retrieval query — even for image-only or vague questions.
  let imageDescription = "";
  if (hasImages) {
    try {
      imageDescription = await describeImages(images!);
    } catch {
      // Non-fatal — fall back to text-only retrieval query
    }
  }

  // Build the retrieval query: image description + user text (deduplicated)
  const retrievalQuery = [imageDescription, question.trim()]
    .filter(Boolean)
    .join("\n\n");

  // 2. Retrieval — skip only for small talk (text-only greetings).
  let chunks: RetrievedChunk[] = [];
  if (!isSmallTalk) {
    try {
      chunks = await retrieve({
        query: retrievalQuery,
        product: products.length === 1 ? products[0] : null,
        matchCount: 6,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Retrieval failed", details: String(err) }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
  }

  // Build rich citation list — order matches [^n] markers in the prompt.
  const citations: Citation[] = chunks.map((c, i) => ({
    index: i + 1,
    document_id: c.document_id,
    title: c.title,
    page_number: c.page_number,
    content: c.content,
    similarity: c.similarity,
    rrf_score: c.rrf_score,
    vector_rank: c.vector_rank,
    keyword_rank: c.keyword_rank,
  }));

  // For the user-facing prompt: use image description as the question when no
  // text was provided, so buildPrompt has something meaningful to work with.
  const effectiveQuestion = hasText ? question : imageDescription;

  const prompt = isSmallTalk
    ? `Conversation so far:\n${history.length > 0 ? history.map((m) => `${m.role}: ${m.content}`).join("\n") : "(no prior turns)"}\n\nUser message:\n${question}\n\nReply now without citations.`
    : buildPrompt({
        history: history.map((m, i) => ({
          id: `h-${i}`,
          role: m.role,
          content: m.content,
          createdAt: 0,
        })),
        question: effectiveQuestion,
        chunks,
        targetProducts: products.length > 0 ? products : undefined,
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
        `  [${i + 1}] ${c.title} p.${c.page_number} (sim=${c.similarity.toFixed(3)} rrf=${c.rrf_score.toFixed(4)} vec=${c.vector_rank ?? "-"} kw=${c.keyword_rank ?? "-"})\n      ${c.content.slice(0, 120).replace(/\n/g, " ")}…`,
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
          systemInstruction: isSmallTalk ? SMALL_TALK_SYSTEM_PROMPT : SYSTEM_PROMPT,
          prompt,
          images,
        })) {
          controller.enqueue(encoder.encode(`data: ${escapeSseData(delta)}\n\n`));
        }

        if (!isSmallTalk && citations.length > 0) {
          controller.enqueue(
            encoder.encode(
              `event: citations\ndata: ${JSON.stringify({ citations })}\n\n`,
            ),
          );
        }

        // Debug frame — always emitted; client only renders when debug mode is on.
        controller.enqueue(
          encoder.encode(
            `event: debug\ndata: ${JSON.stringify({
              systemInstruction: isSmallTalk ? SMALL_TALK_SYSTEM_PROMPT : SYSTEM_PROMPT,
              userPrompt: prompt,
              chunks,
            })}\n\n`,
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
