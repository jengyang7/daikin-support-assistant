# Daikin Support Assistant

A RAG-powered support assistant for Daikin products. Upload PDFs into a knowledge base, then ask natural-language questions and get answers grounded in the official documentation with inline source citations (doc + page).

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase Postgres + pgvector + Storage · Google Gemini (`text-embedding-004` + `gemini-2.0-flash`).

## Features

- **Chat** — streaming answers with `[source p.N]` citation chips that open the source PDF at the cited page
- **Per-product filter** — narrow retrieval to Reiri Home / Office / Hotel
- **Document library** — searchable, filterable grid of all uploaded PDFs
- **In-app PDF upload** — drag-and-drop ingestion: parse → chunk → embed → store, all in one click
- **Local chat history** — conversations persist in `localStorage` (no auth required for the MVP)

## Setup

### 1. Install dependencies

```bash
npm install        # or pnpm install / yarn
```

### 2. Create a Supabase project

1. Go to <https://supabase.com> and create a new project (free tier is fine).
2. In the SQL editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). This:
   - enables the `vector` extension
   - creates the `documents` and `document_chunks` tables
   - creates the `match_chunks` RPC used by retrieval
3. In **Storage**, create a new **private** bucket called `documents`.
4. Grab the following from **Project Settings → API**:
   - `Project URL`
   - `anon public` key
   - `service_role` key (server-only — never ship this to the client)

### 3. Get a Gemini API key

Create one at <https://aistudio.google.com/app/apikey>.

### 4. Configure environment

Copy the template and fill in real values:

```bash
cp .env.local.example .env.local
```

```ini
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_API_KEY=AIza...
```

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/chat`.

## Loading the knowledge base

1. Navigate to **Documents** in the sidebar.
2. Click **Upload PDF**.
3. Drag a PDF from `Daikin Docs/` (or anywhere on your machine), tag it with the right **Product** (Reiri Home / Office / Hotel) and **Type** (Manual / Guide / Technical / Reference), and click **Upload & embed**.
4. Repeat for each PDF you want in the knowledge base.

Each upload runs end-to-end in `app/api/ingest/route.ts`:
1. PDF stored in Supabase Storage
2. `unpdf` extracts per-page text
3. Page-aware recursive chunker (`lib/rag/chunk.ts`) splits each page into ~800-token chunks with 100-token overlap, preserving the page number on every chunk
4. Gemini `text-embedding-004` embeds all chunks (768-dim, batched 100 at a time)
5. One `documents` row + N `document_chunks` rows are inserted

## How retrieval + generation works

`app/api/chat/route.ts` orchestrates the full RAG flow:

1. Embed the user's question with Gemini
2. Call the `match_chunks` RPC (cosine similarity, optional product / doc-type filter, top 6)
3. Build a prompt that lists the retrieved chunks as numbered sources `[1]`, `[2]`, …
4. Stream Gemini `gemini-2.0-flash` output back to the browser as Server-Sent Events
5. After the answer finishes, send a final `event: citations` frame mapping `[^n]` markers to `{ document_id, title, page_number }`
6. The client renders source chips that link directly to the underlying PDF at the cited page

The system prompt (`lib/rag/prompt.ts`) instructs Gemini to refuse questions it can't ground in the retrieved chunks, so the assistant stays factual.

## Project structure

```
app/
  layout.tsx                  # shell + sidebar
  page.tsx                    # redirects to /chat
  chat/page.tsx               # Chat view
  documents/page.tsx          # Document Library
  api/
    chat/route.ts             # SSE-streaming RAG endpoint
    ingest/route.ts           # PDF upload + embed
    documents/route.ts        # list / delete / signed URLs
components/
  sidebar.tsx
  chat/
    chat-window.tsx           # streaming + persistence
    message-bubble.tsx        # markdown + citation chips
    source-chip.tsx
    product-filter.tsx
    chat-input.tsx
    use-document-urls.ts
  documents/
    document-library.tsx
    document-card.tsx
    upload-dialog.tsx
lib/
  supabase/{server,browser}.ts
  gemini.ts                   # embed + streamGenerate helpers
  rag/
    pdf.ts                    # unpdf wrapper
    chunk.ts                  # page-aware chunker
    ingest.ts                 # full ingestion pipeline
    retrieve.ts               # query embed + match_chunks RPC
    prompt.ts                 # system prompt + context assembly
  chat-history.ts             # localStorage CRUD
  utils.ts
types/index.ts
supabase/migrations/0001_init.sql
```

## Troubleshooting

- **Embeddings fail with 401** — double-check `GOOGLE_API_KEY`. The key must have access to the Generative Language API in Google AI Studio.
- **`match_chunks does not exist`** — re-run the SQL migration; the function is created at the end of `0001_init.sql`.
- **`PDF produced 0 chunks`** — the PDF is image-only / scanned. Run it through OCR first (e.g. `ocrmypdf`) before uploading.
- **Citation chips are not clickable** — make sure the `documents` storage bucket exists and `SUPABASE_SERVICE_ROLE_KEY` is set so the server can mint signed URLs.

## Notes

- No auth in this MVP — anyone with the URL can upload and chat. Put it behind your own access control before exposing it publicly.
- Conversations live in `localStorage` only. Clearing browser data wipes them.
- The chunker uses a character-based heuristic (~4 chars/token). For very dense technical PDFs you may want a tokenizer-based splitter — swap `lib/rag/chunk.ts` for `tiktoken` or `@huggingface/tokenizers` if needed.
