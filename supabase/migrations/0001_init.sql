-- Daikin Support Assistant — initial schema
-- Run this in Supabase SQL editor (or `supabase db push`) once per project.

create extension if not exists vector;

-- =============================================================
-- documents: one row per uploaded PDF
-- =============================================================
create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  filename        text not null,
  storage_path    text not null,
  product         text,                       -- 'reiri_home' | 'reiri_office' | 'reiri_hotel' | null
  doc_type        text,                       -- 'manual' | 'guide' | 'technical' | 'reference'
  description     text,
  page_count      int,
  file_size_bytes bigint,
  created_at      timestamptz not null default now()
);

create index if not exists documents_product_idx  on documents (product);
create index if not exists documents_doc_type_idx on documents (doc_type);

-- =============================================================
-- document_chunks: one row per ~800-token slice of a PDF page
-- embedding dimension matches Gemini text-embedding-004 (768)
-- =============================================================
create table if not exists document_chunks (
  id           bigserial primary key,
  document_id  uuid not null references documents(id) on delete cascade,
  chunk_index  int not null,
  page_number  int not null,
  content      text not null,
  embedding    vector(768) not null
);

create index if not exists document_chunks_document_id_idx
  on document_chunks (document_id);

-- HNSW cosine index for ANN search
create index if not exists document_chunks_embedding_hnsw
  on document_chunks
  using hnsw (embedding vector_cosine_ops);

-- =============================================================
-- match_chunks RPC — called by /api/chat at retrieval time
-- =============================================================
create or replace function match_chunks (
  query_embedding vector(768),
  match_count     int  default 6,
  filter_product  text default null,
  filter_doc_type text default null
)
returns table (
  chunk_id    bigint,
  document_id uuid,
  title       text,
  filename    text,
  page_number int,
  content     text,
  similarity  float
)
language sql
stable
as $$
  select
    dc.id            as chunk_id,
    dc.document_id,
    d.title,
    d.filename,
    dc.page_number,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where (filter_product  is null or d.product  = filter_product)
    and (filter_doc_type is null or d.doc_type = filter_doc_type)
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- =============================================================
-- Storage bucket setup (run separately in Supabase Studio)
-- -------------------------------------------------------------
-- 1. Storage -> New bucket -> name: "documents", public: false
-- 2. No additional policies needed: the app uses the
--    service role key from server routes only.
-- =============================================================
