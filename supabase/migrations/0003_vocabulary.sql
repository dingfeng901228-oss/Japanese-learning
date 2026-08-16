-- 0003_vocabulary.sql
-- Vocabulary collection + SRS review feature.
-- Per docs/0817requirement.docx §24 (数据库设计), §25 (用户数据隔离).
--
-- Run AFTER 0001_init.sql + 0002_rls.sql.
-- Reuses the public.set_updated_at() trigger function from 0001_init.sql.

-- ==========================================================================
-- vocabulary_items
-- ==========================================================================
create table if not exists public.vocabulary_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null check (type in ('word', 'phrase', 'grammar', 'sentence')),
  word            text not null,
  reading         text,
  meaning         text not null,
  language        text not null default 'ja',
  part_of_speech  text,
  level           text,
  mastery         integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists vocabulary_items_user_id_idx on public.vocabulary_items (user_id);

-- ==========================================================================
-- vocabulary_examples
-- ==========================================================================
create table if not exists public.vocabulary_examples (
  id              uuid primary key default gen_random_uuid(),
  vocabulary_id   uuid not null references public.vocabulary_items(id) on delete cascade,
  sentence        text not null,
  translation     text,
  reading         text,
  is_primary      boolean not null default false,
  generated_by_ai boolean not null default true,
  user_edited     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists vocabulary_examples_vocabulary_id_idx on public.vocabulary_examples (vocabulary_id);
-- Per-vocabulary constraint: at most one primary example.
create unique index if not exists vocabulary_examples_one_primary
  on public.vocabulary_examples (vocabulary_id)
  where is_primary = true;

-- ==========================================================================
-- vocabulary_reviews
-- ==========================================================================
create table if not exists public.vocabulary_reviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  vocabulary_id   uuid not null references public.vocabulary_items(id) on delete cascade,
  example_id      uuid references public.vocabulary_examples(id) on delete set null,
  review_type     text,
  user_answer     text,
  correct         boolean,
  reviewed_at     timestamptz not null default now(),
  next_review_at  timestamptz,
  interval_days   integer not null default 0,
  ease_factor     numeric not null default 2.5,
  mastery         integer not null default 0
);
create index if not exists vocabulary_reviews_user_id_idx on public.vocabulary_reviews (user_id);
create index if not exists vocabulary_reviews_vocabulary_id_idx on public.vocabulary_reviews (vocabulary_id);
-- Drives the "今日复习" queue — filtered by user + due time.
create index if not exists vocabulary_reviews_next_review_idx
  on public.vocabulary_reviews (user_id, next_review_at);

-- ==========================================================================
-- vocabulary_tags
-- ==========================================================================
create table if not exists public.vocabulary_tags (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  vocabulary_id   uuid not null references public.vocabulary_items(id) on delete cascade,
  tag             text not null,
  created_at      timestamptz not null default now()
);
create index if not exists vocabulary_tags_user_id_idx on public.vocabulary_tags (user_id);
create index if not exists vocabulary_tags_vocabulary_id_idx on public.vocabulary_tags (vocabulary_id);
create unique index if not exists vocabulary_tags_unique
  on public.vocabulary_tags (user_id, vocabulary_id, tag);

-- ==========================================================================
-- updated_at triggers (reuse the function from 0001_init.sql)
-- ==========================================================================
do $$
declare
  t text;
begin
  foreach t in array array['vocabulary_items', 'vocabulary_examples'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at
         before update on public.%1$s
         for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end;
$$;

-- ==========================================================================
-- RLS — auth.uid() = user_id (or via parent for vocabulary_examples)
-- ==========================================================================
alter table public.vocabulary_items    enable row level security;
alter table public.vocabulary_examples enable row level security;
alter table public.vocabulary_reviews  enable row level security;
alter table public.vocabulary_tags     enable row level security;

-- vocabulary_items
create policy "vocabulary_items_select_own"
  on public.vocabulary_items for select
  using (auth.uid() = user_id);
create policy "vocabulary_items_insert_own"
  on public.vocabulary_items for insert
  with check (auth.uid() = user_id);
create policy "vocabulary_items_update_own"
  on public.vocabulary_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "vocabulary_items_delete_own"
  on public.vocabulary_items for delete
  using (auth.uid() = user_id);

-- vocabulary_examples: ownership via parent vocabulary_items (FK join check).
create policy "vocabulary_examples_select_own"
  on public.vocabulary_examples for select
  using (exists (
    select 1 from public.vocabulary_items
    where id = vocabulary_examples.vocabulary_id and user_id = auth.uid()
  ));
create policy "vocabulary_examples_insert_own"
  on public.vocabulary_examples for insert
  with check (exists (
    select 1 from public.vocabulary_items
    where id = vocabulary_examples.vocabulary_id and user_id = auth.uid()
  ));
create policy "vocabulary_examples_update_own"
  on public.vocabulary_examples for update
  using (exists (
    select 1 from public.vocabulary_items
    where id = vocabulary_examples.vocabulary_id and user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.vocabulary_items
    where id = vocabulary_examples.vocabulary_id and user_id = auth.uid()
  ));
create policy "vocabulary_examples_delete_own"
  on public.vocabulary_examples for delete
  using (exists (
    select 1 from public.vocabulary_items
    where id = vocabulary_examples.vocabulary_id and user_id = auth.uid()
  ));

-- vocabulary_reviews
create policy "vocabulary_reviews_select_own"
  on public.vocabulary_reviews for select
  using (auth.uid() = user_id);
create policy "vocabulary_reviews_insert_own"
  on public.vocabulary_reviews for insert
  with check (auth.uid() = user_id);
create policy "vocabulary_reviews_update_own"
  on public.vocabulary_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "vocabulary_reviews_delete_own"
  on public.vocabulary_reviews for delete
  using (auth.uid() = user_id);

-- vocabulary_tags
create policy "vocabulary_tags_select_own"
  on public.vocabulary_tags for select
  using (auth.uid() = user_id);
create policy "vocabulary_tags_insert_own"
  on public.vocabulary_tags for insert
  with check (auth.uid() = user_id);
create policy "vocabulary_tags_update_own"
  on public.vocabulary_tags for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "vocabulary_tags_delete_own"
  on public.vocabulary_tags for delete
  using (auth.uid() = user_id);

-- ==========================================================================
-- Verify
-- ==========================================================================
-- After running this migration, expect:
--   select tablename, rowsecurity from pg_tables
--   where schemaname='public' and tablename like 'vocabulary_%';
-- to show 4 rows with rowsecurity = true.
