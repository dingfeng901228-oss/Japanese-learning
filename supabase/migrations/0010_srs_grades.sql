-- 0010_srs_grades.sql
-- Audit 2026-11-16 P1-6: four-grade spaced repetition.
--
-- The review flow had two grades (再来一次 / 记住了), so a word could
-- only ever move between "interval 1 day" and "interval x ease" —
-- there was no way to say "I nearly knew it" or "that was easy".
--
-- This adds the grade column the four-grade schedule writes, plus the
-- index the "待复习" filter and the due count need.
--
-- Existing rows keep last_grade = NULL: they were graded under the
-- old two-grade scale, and the new scale is not comparable.

alter table public.vocabulary_reviews
  add column if not exists last_grade text;

comment on column public.vocabulary_reviews.last_grade is
  'Last grade: again | hard | good | easy. NULL for rows graded under the old two-grade scale.';

-- The "待复习" filter and the due count both look for
-- next_review_at <= now. A partial index on the due rows keeps that
-- cheap as the collection grows.
create index if not exists vocabulary_reviews_due_idx
  on public.vocabulary_reviews (user_id, next_review_at)
  where next_review_at is not null;
