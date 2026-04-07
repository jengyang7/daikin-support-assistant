import "server-only";
import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
const GENERATION_MODEL = "gemini-2.5-flash";

let cached: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (cached) return cached;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_API_KEY env var");
  cached = new GoogleGenAI({ apiKey });
  return cached;
}

/**
 * Embed a batch of texts. Gemini's text-embedding-004 returns 768-dim vectors.
 * Batches larger than 100 are chunked automatically.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = client();
  const out: number[][] = [];

  // Gemini accepts up to 100 inputs per call.
  const BATCH = 100;
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const res = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: slice.map((t) => ({ role: "user", parts: [{ text: t }] })),
      config: { outputDimensionality: 768 },
    });
    const embeddings = res.embeddings ?? [];
    for (const e of embeddings) {
      if (!e.values) throw new Error("Gemini embedding response missing values");
      out.push(e.values);
    }
  }

  if (out.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: requested ${texts.length}, got ${out.length}`,
    );
  }
  return out;
}

/** Embed a single string and return its 768-dim vector. */
export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}

/**
 * Stream a Gemini generation. Yields raw text deltas.
 * `systemInstruction` becomes the model's system prompt; `prompt` is the user turn.
 */
export async function* streamGenerate(opts: {
  systemInstruction: string;
  prompt: string;
}): AsyncGenerator<string> {
  const ai = client();
  const stream = await ai.models.generateContentStream({
    model: GENERATION_MODEL,
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    config: {
      systemInstruction: {
        parts: [{ text: opts.systemInstruction }],
      },
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}
