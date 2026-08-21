-- 0005_chrome_extension.sql
-- Chrome Extension integration: Extension Token auth + vocabulary source tracking.
-- Per docs/0821requirements.docx §14-16 (Token + duplicate detection),
-- §22-24 (source URL/title), §25 (server-side validation).
--
-- Run AFTER 0001_init.sql + 0002_rls.sql + 0003_vocabulary.sql + 0004_daily_rollups.sql.
-- Defensive: re-creates public.set_updated_at() trigger function (idempotent — same
-- defensive pattern as 0003_vocabulary.sql).

-- ==========================================================================
-- Defensive: re-create the updated_at trigger function (idempotent).
-- ==========================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ==========================================================================
-- extension_connect_codes (one-time 10-minute connect codes)
-- Per Frank 需求 §15 + §16: user mints a 6-character code in Settings →
-- Browser Extension, pastes it in the Chrome extension. Server validates,
-- marks consumed, issues a long-term token.
-- ==========================================================================
create table if not exists public.extension_connect_codes (
  code_hash   text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists extension_connect_codes_user_id_idx
  on public.extension_connect_codes (user_id);
create index if not exists extension_connect_codes_expires_at_idx
  on public.extension_connect_codes (expires_at);

-- ==========================================================================
-- extension_tokens (long-term Bearer tokens; only SHA-256 hash stored)
-- Per Frank 需求 §16: random 32 bytes base64url (~43 chars), only hash
-- saved in DB; rotation + revocation + last_used_at supported.
-- ==========================================================================
create table if not exists public.extension_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  token_hash   text not null unique,
  label        text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
create index if not exists extension_tokens_user_id_idx
  on public.extension_tokens (user_id);
-- Partial index: only non-revoked tokens, used by /api/vocabulary auth
-- check (skips dead tokens for fast lookup).
create index if not exists extension_tokens_token_hash_active_idx
  on public.extension_tokens (token_hash)
  where revoked_at is null;

-- ==========================================================================
-- vocabulary_items: add source tracking columns (per Frank 需求 §10, §22-23)
-- ==========================================================================
alter table public.vocabulary_items
  add column if not exists source text;
alter table public.vocabulary_items
  add column if not exists source_url text;
alter table public.vocabulary_items
  add column if not exists source_title text;
alter table public.vocabulary_items
  add column if not exists source_domain text;
alter table public.vocabulary_items
  add column if not exists source_favicon text;
alter table public.vocabulary_items
  add column if not exists source_added_at timestamptz;

-- ==========================================================================
-- Vocabulary duplicate detection (per Frank 需求 §14)
-- user_id + word + reading must be unique (NULL reading treated
-- separately via two partial indexes — SQL standard treats NULL
-- comparison as not-equal in composite UNIQUE).
-- ==========================================================================
create unique index if not exists vocabulary_items_user_word_reading_unique
  on public.vocabulary_items (user_id, word, reading)
  where reading is not null;
create unique index if not exists vocabulary_items_user_word_no_reading_unique
  on public.vocabulary_items (user_id, word)
  where reading is null;

-- Helpful for the /vocabulary page stats query
-- "vocabulary items where source = 'chrome-extension'".
create index if not exists vocabulary_items_user_source_idx
  on public.vocabulary_items (user_id, source);

-- ==========================================================================
-- RLS — auth.uid() = user_id
-- ==========================================================================
alter table public.extension_connect_codes enable row level security;
alter table public.extension_tokens          enable row level security;

-- extension_connect_codes: user can read their own codes (e.g. UI status
-- "you have an unconsumed code expiring in 4:32"). Inserts go through
-- server actions / API routes with the user's session.
create policy "extension_connect_codes_select_own"
  on public.extension_connect_codes for select
  using (auth.uid() = user_id);
-- DELETE intentionally omitted — codes expire by `expires_at`, not user delete.

-- extension_tokens: user can list / revoke their own tokens. Inserts
-- happen via /api/extension/connect (which uses the user's auth session
-- to mint a new row). Updates to last_used_at happen via service-role
-- in /api/vocabulary (the user can't update their own token's hash).
create policy "extension_tokens_select_own"
  on public.extension_tokens for select
  using (auth.uid() = user_id);
create policy "extension_tokens_update_own"
  on public.extension_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "extension_tokens_delete_own"
  on public.extension_tokens for delete
  using (auth.uid() = user_id);

-- ==========================================================================
-- Verify
-- ==========================================================================
-- After this migration, expect:
--   select tablename, rowsecurity from pg_tables
--   where schemaname='public' and tablename like 'extension_%';
-- to show 2 rows with rowsecurity = true.
-- vocabulary_items now has 6 new nullable columns: source, source_url,
-- source_title, source_domain, source_favicon, source_added_at.