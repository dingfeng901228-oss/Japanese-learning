-- 0016_vocab_count_rpcs.sql
-- Audit 2026-11-16 P1-13 / P1-11 / P1-10.
--
-- The type filter shows "单词 (943) 词组 (57)" - 1,000 exactly. That is
-- PostgREST's default row cap, not the real count: the collection has
-- 3,254 words and 93 phrases. The same cap truncated the theme counts
-- (vocabulary_tags holds 2,912 rows for this user).
--
-- Counting in the database is the only correct way. Both functions are
-- SECURITY INVOKER, so the existing RLS on vocabulary_items /
-- vocabulary_tags still scopes them to auth.uid().

create or replace function public.get_vocab_type_counts()
returns table (type text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select vi.type, count(*)::bigint
  from public.vocabulary_items vi
  where vi.user_id = auth.uid()
  group by vi.type;
$$;

revoke all on function public.get_vocab_type_counts() from public;
grant execute on function public.get_vocab_type_counts() to authenticated;

create or replace function public.get_vocab_tag_counts()
returns table (tag text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select vt.tag, count(*)::bigint
  from public.vocabulary_tags vt
  where vt.user_id = auth.uid() and vt.tag <> ''
  group by vt.tag;
$$;

revoke all on function public.get_vocab_tag_counts() from public;
grant execute on function public.get_vocab_tag_counts() to authenticated;
