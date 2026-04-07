-- 0002_hybrid_search.sql
-- Add BM25 full-text search column + hybrid search RPC with Reciprocal Rank Fusion.
-- Run in Supabase SQL editor after 0001_init.sql.

-- 1. Add generated tsvector column for full-text search (auto-backfills existing rows).
alter table document_chunks
  add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', content)) stored;

-- 2. GIN index for fast tsvector lookups.
create index if not exists document_chunks_content_tsv_idx
  on document_chunks using gin (content_tsv);

-- 3. Hybrid search RPC: vector cosine (top 20) + BM25 keyword (top 20),
--    fused with Reciprocal Rank Fusion (k=60).
create or replace function match_chunks_hybrid(
  query_text      text,
  query_embedding vector(768),
  match_count     int  default 6,
  filter_product  text default null,
  filter_doc_type text default null
)
returns table (
  chunk_id      bigint,
  document_id   uuid,
  title         text,
  filename      text,
  page_number   int,
  content       text,
  similarity    float,
  vector_rank   int,
  keyword_rank  int,
  rrf_score     float
)
language sql
stable
as $$
  with
  -- Top 20 by vector cosine similarity.
  vec as (
    select
      dc.id                                    as chunk_id,
      dc.document_id,
      d.title,
      d.filename,
      dc.page_number,
      dc.content,
      1 - (dc.embedding <=> query_embedding)   as similarity,
      row_number() over (
        order by dc.embedding <=> query_embedding
      )                                        as vec_rank
    from document_chunks dc
    join documents d on d.id = dc.document_id
    where (filter_product  is null or d.product  = filter_product)
      and (filter_doc_type is null or d.doc_type = filter_doc_type)
    order by dc.embedding <=> query_embedding
    limit 20
  ),
  -- Top 20 by BM25 keyword score (ts_rank_cd).
  kw as (
    select
      dc.id                                    as chunk_id,
      dc.document_id,
      d.title,
      d.filename,
      dc.page_number,
      dc.content,
      1 - (dc.embedding <=> query_embedding)   as similarity,
      row_number() over (
        order by ts_rank_cd(
          dc.content_tsv,
          websearch_to_tsquery('english', query_text)
        ) desc
      )                                        as kw_rank
    from document_chunks dc
    join documents d on d.id = dc.document_id
    where (filter_product  is null or d.product  = filter_product)
      and (filter_doc_type is null or d.doc_type = filter_doc_type)
      and dc.content_tsv @@ websearch_to_tsquery('english', query_text)
    order by ts_rank_cd(
      dc.content_tsv,
      websearch_to_tsquery('english', query_text)
    ) desc
    limit 20
  ),
  -- Reciprocal Rank Fusion: score = sum(1 / (60 + rank)) across both lists.
  rrf as (
    select
      coalesce(v.chunk_id,    k.chunk_id)    as chunk_id,
      coalesce(v.document_id, k.document_id) as document_id,
      coalesce(v.title,       k.title)       as title,
      coalesce(v.filename,    k.filename)    as filename,
      coalesce(v.page_number, k.page_number) as page_number,
      coalesce(v.content,     k.content)     as content,
      coalesce(v.similarity,  k.similarity)  as similarity,
      v.vec_rank                             as vector_rank,
      k.kw_rank                             as keyword_rank,
      coalesce(1.0 / (60 + v.vec_rank), 0) +
      coalesce(1.0 / (60 + k.kw_rank),  0)  as rrf_score
    from vec v
    full outer join kw k on k.chunk_id = v.chunk_id
  )
  select
    chunk_id,
    document_id,
    title,
    filename,
    page_number,
    content,
    similarity,
    vector_rank,
    keyword_rank,
    rrf_score
  from rrf
  order by rrf_score desc
  limit match_count;
$$;
