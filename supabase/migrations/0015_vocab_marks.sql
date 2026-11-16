-- 0015_vocab_marks.sql
-- Audit 2026-11-16 P1-10: "生词标记：加星标、自定义标签、手动「已掌握/易忘」
-- 标记，并支持按掌握度区间和标签筛选".
--
-- Two new columns on vocabulary_items:
--
--   starred    — the user's own star (生词 / worth another look). It is
--                NOT the same as mastery: a word can be starred and still
--                be at 0% mastery.
--   mark_state — a manual judgement that overrides nothing but tells the
--                learner what they decided: 'mastered' (已掌握) or
--                'weak' (易忘). NULL means "no manual mark".
--
-- The custom tags already exist in vocabulary_tags (that is where the
-- imported category went), so the tag UI reuses it.

alter table public.vocabulary_items
  add column if not exists starred boolean not null default false;

alter table public.vocabulary_items
  add column if not exists mark_state text;

comment on column public.vocabulary_items.starred is
  'The user starred this word (生词). Independent of mastery.';

comment on column public.vocabulary_items.mark_state is
  'Manual mark: mastered | weak | NULL. Independent of the SRS mastery.';

-- The list filter "待复习" and the new "已标记" filter both look for
-- starred words, so give the filter an index.
create index if not exists vocabulary_items_starred_idx
  on public.vocabulary_items (user_id, starred)
  where starred;

create index if not exists vocabulary_items_mark_state_idx
  on public.vocabulary_items (user_id, mark_state)
  where mark_state is not null;
