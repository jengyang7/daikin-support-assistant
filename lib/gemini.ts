import "server-only";
import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
const GENERATION_MODEL = "gemini-2.5-flash-lite";

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
 * Ask Gemini to produce a concise technical description of one or more images.
 * Used to generate a meaningful RAG retrieval query when the user's text is
 * absent or too vague (e.g. image-only or "why?").
 */
export async function describeImages(
  images: Array<{ mimeType: string; data: string }>,
): Promise<string> {
  const ai = client();

  type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
  const parts: Part[] = [
    {
      text: "Describe the attached image(s) in concise technical terms relevant to Daikin / Reiri HVAC systems. Include any visible: model numbers, error codes, component names, wiring details, or physical damage. Plain text only, no markdown, 2–4 sentences max.",
    },
    ...images.map((img) => ({ inlineData: img })),
  ];

  const res = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: [{ role: "user", parts }],
    config: { temperature: 0, maxOutputTokens: 256 },
  });

  return res.text?.trim() ?? "";
}

/**
 * Stream a Gemini generation. Yields raw text deltas.
 * `systemInstruction` becomes the model's system prompt; `prompt` is the user turn.
 * Optional `images` are appended as `inlineData` parts after the text.
 */
export async function* streamGenerate(opts: {
  systemInstruction: string;
  prompt: string;
  images?: Array<{ mimeType: string; data: string }>;
}): AsyncGenerator<string> {
  const ai = client();

  type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
  const parts: Part[] = [{ text: opts.prompt }];
  for (const img of opts.images ?? []) {
    parts.push({ inlineData: img });
  }

  const stream = await ai.models.generateContentStream({
    model: GENERATION_MODEL,
    contents: [{ role: "user", parts }],
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
