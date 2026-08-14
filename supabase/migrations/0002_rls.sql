-- 0002_rls.sql
-- Enable Row Level Security on all user-scoped tables.
-- Per docs/requirements2.docx §7 (数据隔离).
--
-- Strategy: every policy uses auth.uid() = user_id.
-- The DB is the only enforcement point — the client cannot inject a
-- forged user_id because the policy runs as the authenticated user, and
-- auth.uid() always resolves to the *real* logged-in user.
--
-- Run AFTER 0001_init.sql has applied without errors.

-- ==========================================================================
-- Enable RLS (default-deny).
-- Once enabled, no row is visible unless a policy says so.
-- ==========================================================================
alter table public.study_sessions    enable row level security;
alter table public.knowledge_points enable row level security;
alter table public.questions        enable row level security;
alter table public.attempts         enable row level security;
alter table public.reviews          enable row level security;
alter table public.mistakes         enable row level security;

-- ==========================================================================
-- study_sessions
-- ==========================================================================
create policy "study_sessions_select_own"
  on public.study_sessions for select
  using (auth.uid() = user_id);
create policy "study_sessions_insert_own"
  on public.study_sessions for insert
  with check (auth.uid() = user_id);
create policy "study_sessions_update_own"
  on public.study_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "study_sessions_delete_own"
  on public.study_sessions for delete
  using (auth.uid() = user_id);

-- ==========================================================================
-- knowledge_points
-- ==========================================================================
create policy "knowledge_points_select_own"
  on public.knowledge_points for select
  using (auth.uid() = user_id);
create policy "knowledge_points_insert_own"
  on public.knowledge_points for insert
  with check (auth.uid() = user_id);
create policy "knowledge_points_update_own"
  on public.knowledge_points for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "knowledge_points_delete_own"
  on public.knowledge_points for delete
  using (auth.uid() = user_id);

-- ==========================================================================
-- questions
-- ==========================================================================
create policy "questions_select_own"
  on public.questions for select
  using (auth.uid() = user_id);
create policy "questions_insert_own"
  on public.questions for insert
  with check (auth.uid() = user_id);
create policy "questions_update_own"
  on public.questions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "questions_delete_own"
  on public.questions for delete
  using (auth.uid() = user_id);

-- ==========================================================================
-- attempts
-- ==========================================================================
create policy "attempts_select_own"
  on public.attempts for select
  using (auth.uid() = user_id);
create policy "attempts_insert_own"
  on public.attempts for insert
  with check (auth.uid() = user_id);
create policy "attempts_update_own"
  on public.attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "attempts_delete_own"
  on public.attempts for delete
  using (auth.uid() = user_id);

-- ==========================================================================
-- reviews
-- ==========================================================================
create policy "reviews_select_own"
  on public.reviews for select
  using (auth.uid() = user_id);
create policy "reviews_insert_own"
  on public.reviews for insert
  with check (auth.uid() = user_id);
create policy "reviews_update_own"
  on public.reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "reviews_delete_own"
  on public.reviews for delete
  using (auth.uid() = user_id);

-- ==========================================================================
-- mistakes
-- ==========================================================================
create policy "mistakes_select_own"
  on public.mistakes for select
  using (auth.uid() = user_id);
create policy "mistakes_insert_own"
  on public.mistakes for insert
  with check (auth.uid() = user_id);
create policy "mistakes_update_own"
  on public.mistakes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "mistakes_delete_own"
  on public.mistakes for delete
  using (auth.uid() = user_id);

-- ==========================================================================
-- Verify
-- ==========================================================================
-- After running this migration, expect:
--   select tablename, rowsecurity from pg_tables where schemaname='public';
-- to show rowsecurity = true for all six tables.
