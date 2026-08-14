-- 0001_init.sql
-- Initial schema for FastStudy 2.0 user-scoped tables.
-- Per docs/requirements2.docx §6 (用户数据设计) + §7 (数据隔离).
-- Must be applied BEFORE 0002_rls.sql — RLS policies reference these tables.

create extension if not exists "pgcrypto";

-- ==========================================================================
-- study_sessions
-- ==========================================================================
create table if not exists public.study_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  subject     text not null,
  level       text,
  goal        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists study_sessions_user_id_idx on public.study_sessions (user_id);

-- ==========================================================================
-- knowledge_points
-- ==========================================================================
create table if not exists public.knowledge_points (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  session_id   uuid references public.study_sessions(id) on delete cascade,
  topic        text not null,
  content      text not null,
  difficulty   text,
  mastery      integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists knowledge_points_user_id_idx on public.knowledge_points (user_id);
create index if not exists knowledge_points_session_id_idx on public.knowledge_points (session_id);

-- ==========================================================================
-- questions
-- ==========================================================================
create table if not exists public.questions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  knowledge_point_id   uuid references public.knowledge_points(id) on delete cascade,
  type                 text not null,
  question             text not null,
  answer               text,
  difficulty           text,
  created_at           timestamptz not null default now()
);
create index if not exists questions_user_id_idx on public.questions (user_id);
create index if not exists questions_kp_id_idx on public.questions (knowledge_point_id);

-- ==========================================================================
-- attempts
-- ==========================================================================
create table if not exists public.attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  question_id  uuid references public.questions(id) on delete set null,
  user_answer  text,
  correct      boolean,
  score        numeric,
  answered_at  timestamptz not null default now()
);
create index if not exists attempts_user_id_idx on public.attempts (user_id);
create index if not exists attempts_question_id_idx on public.attempts (question_id);

-- ==========================================================================
-- reviews
-- ==========================================================================
create table if not exists public.reviews (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  knowledge_point_id    uuid references public.knowledge_points(id) on delete cascade,
  last_reviewed_at      timestamptz,
  next_review_at        timestamptz,
  interval_days         integer not null default 0,
  correct_count         integer not null default 0,
  wrong_count           integer not null default 0,
  mastery               integer not null default 0
);
create index if not exists reviews_user_id_idx on public.reviews (user_id);
create index if not exists reviews_kp_id_idx on public.reviews (knowledge_point_id);

-- ==========================================================================
-- mistakes
-- ==========================================================================
create table if not exists public.mistakes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  question_id      uuid references public.questions(id) on delete set null,
  user_answer      text,
  correct_answer   text,
  reason           text,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index if not exists mistakes_user_id_idx on public.mistakes (user_id);
create index if not exists mistakes_question_id_idx on public.mistakes (question_id);

-- ==========================================================================
-- Trigger: auto-bump updated_at on UPDATE for tables that have it
-- ==========================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array['study_sessions', 'knowledge_points'] loop
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
