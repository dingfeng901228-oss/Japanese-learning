-- 0003_mistake_history.sql
-- Cross-session mistake tracking with structured pattern types.
-- P1.C from docs/phase1-enhancement-scope.md (Phase 1 增强 #3, foundation).
--
-- Replaces the localStorage-only `japaneseLearning.mistakeHistory` flow
-- (which used free-text grammar[] / vocabulary[] in app/speaking/page.tsx)
-- with a Supabase-backed table that exposes:
--   - Structured pattern type (re-uses P1.B's 7-type IssueType enum)
--   - Lightweight SRS state (review_count + next_review_at)
--   - Per-user RLS so the DB enforces data isolation
--
-- Pairs with lib/mistake-storage.ts (the storage abstraction that picks
-- Supabase here when authed, localStorage when anonymous, and migrates
-- on first auth).
--
-- Run AFTER 0001_init.sql + 0002_rls.sql — references auth.users which
-- those migrations depend on.

-- ==========================================================================
-- mistake_history
-- ==========================================================================
create table mistake_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  sentence_id     text not null,
  sentence_target text not null,        -- the "正しい" version
  transcript      text,                 -- what learner actually said (nullable for grade-only errors)
  pattern_type    text not null,        -- particle-confusion | kanji-reading | pitch-accent | verb-conjugation | missing-word | extra-word | word-order
  severity        text not null,        -- minor | major | critical
  hint            text,
  detected_at     timestamptz not null default now(),
  review_count    int not null default 0,
  next_review_at  timestamptz
);

-- Single-column lookups by user.
create index mistake_history_user_id_idx
  on mistake_history (user_id);

-- Aggregate-by-pattern lookups (P1.C: /today "最近弱点" + reviewQueue).
create index mistake_history_user_pattern_idx
  on mistake_history (user_id, pattern_type);

-- SRS review queue: prioritize by next_review_at per user.
create index mistake_history_review_idx
  on mistake_history (user_id, next_review_at);

-- ==========================================================================
-- RLS — users only see / mutate their own mistakes.
-- Mirrors the strategy in 0002_rls.sql: auth.uid() = user_id, with the
-- `for all` shortcut because we don't need per-action granularity here
-- (records are append-only in practice and the abstraction layer is the
-- only writer). Other slots can split this later if needed.
-- ==========================================================================
alter table mistake_history enable row level security;

create policy "users manage own mistakes"
  on mistake_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ==========================================================================
-- Verify (run after applying this migration):
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename = 'mistake_history';
-- expected: rowsecurity = true
-- ==========================================================================
