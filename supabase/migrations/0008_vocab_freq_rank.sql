-- 0008_vocab_freq_rank.sql
-- Vocabulary frequency rank (JMdict priority) — audit 2026-10-09.
--
-- Why: the vocabulary list can now be sorted by "how useful is this
-- word in real Japanese" instead of only by capture time. The rank
-- comes from the Tomoshi open data layer's `freq_rank` table (derived
-- from JMdict's priority markers), captured at add time by the
-- dictionary lookup widget on /vocabulary/new.
--
-- Nullable on purpose: rows added before this migration (and rows
-- whose word wasn't in the dictionary) have no rank. They sort last
-- under the "按常用度" order and simply show no frequency badge.
--
-- The app treats the column as optional — the vocabulary insert falls
-- back to a column-less insert if this migration hasn't been applied
-- yet, so deploy order doesn't matter.
--
-- Run AFTER 0007_vocab_learning_count.sql.

alter table public.vocabulary_items
  add column if not exists freq_rank integer;

comment on column public.vocabulary_items.freq_rank is
  'JMdict-derived frequency rank (lower = more common). Null when unknown.';

-- Supports the "按常用度" sort: order by freq_rank for one user.
-- The partial index keeps it small — only rows that have a rank are
-- in it, which is a fraction of the collection.
create index if not exists vocabulary_items_freq_idx
  on public.vocabulary_items (user_id, freq_rank)
  where freq_rank is not null;
