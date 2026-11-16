-- 0009_vocab_stats.sql
-- Single source of truth for the vocabulary statistics shown on the
-- home page, /vocabulary and /progress.
--
-- Why an RPC instead of a plain SELECT:
--   The progress page read vocabulary_reviews with no .range() call, so
--   PostgREST capped the result at its default 1000 rows. With 3,347
--   saved words the page reported "总词数 1000" while /vocabulary
--   correctly reported 3,347 — the same database, two different numbers
--   depending on which page asked. The distribution histogram and the
--   per-JLPT breakdown were capped the same way.
--
--   Aggregating inside Postgres returns exact counts and ships a few
--   hundred bytes instead of thousands of rows.
--
-- Security: SECURITY INVOKER (the default) — the function runs with the
-- caller's privileges, so the existing RLS policies
-- ("auth.uid() = user_id" on vocabulary_items and vocabulary_reviews)
-- scope every row to the caller. No user_id parameter is accepted, so
-- there is no way to ask for another user's numbers.

create or replace function public.get_vocab_stats(
  p_mastered_threshold integer default 80,
  p_review_threshold integer default 50
)
returns jsonb
language sql
stable
set search_path = public
as $fn$
with items as (
  select
    vi.id,
    vi.level,
    coalesce(vr.mastery, vi.mastery, 0) as mastery,
    vr.next_review_at
  from public.vocabulary_items vi
  left join lateral (
    select r.mastery, r.next_review_at
    from public.vocabulary_reviews r
    where r.vocabulary_id = vi.id
    order by r.reviewed_at desc nulls last
    limit 1
  ) vr on true
)
select jsonb_build_object(
  'total', count(*),
  'mastered', count(*) filter (where mastery >= p_mastered_threshold),
  'needs_review', count(*) filter (where mastery < p_review_threshold),
  'due_now', count(*) filter (
    where next_review_at is not null and next_review_at <= now()
  ),
  'avg_mastery', coalesce(round(avg(mastery)), 0),
  'by_level', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('level', t.level, 'count', t.cnt, 'avg', t.av)
        order by t.lvl
      ),
      '[]'::jsonb
    )
    from (
      select
        coalesce(i.level, '未指定') as level,
        count(*) as cnt,
        coalesce(round(avg(i.mastery)), 0) as av,
        case coalesce(i.level, '未指定')
          when 'N5' then 1 when 'N4' then 2 when 'N3' then 3
          when 'N2' then 4 when 'N1' then 5 else 6
        end as lvl
      from items i
      group by 1
    ) t
  ),
  'distribution', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('bucket', t.bucket, 'count', t.cnt)
        order by t.bucket
      ),
      '[]'::jsonb
    )
    from (
      select least(90, (i.mastery / 10) * 10)::integer as bucket, count(*) as cnt
      from items i
      group by 1
    ) t
  )
)
from items;
$fn$;

comment on function public.get_vocab_stats(integer, integer) is
  'Exact vocabulary statistics for the calling user (RLS-scoped). '
  'Mastery source: vocabulary_reviews.mastery, falling back to '
  'vocabulary_items.mastery. Returns total / mastered / needs_review / '
  'due_now / avg_mastery / by_level / distribution.';
