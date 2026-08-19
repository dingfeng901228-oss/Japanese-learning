-- 0004_daily_rollups.sql
-- Real per-day training rollup table. Replaces the mock heatmap
-- (lib/dashboard-mock.ts buildHeatmapData).
--
-- Per Frank #6219 option 3.
--
-- Run AFTER 0001_init.sql + 0002_rls.sql + 0003_vocabulary.sql.
-- Defensive: re-creates public.set_updated_at() trigger function in case
-- 0001_init.sql was never applied or the function was dropped later.
-- CREATE OR REPLACE is idempotent — if the function already exists with
-- the same definition, no-op.

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
-- daily_rollups
-- ==========================================================================
create table if not exists public.daily_rollups (
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  minutes          numeric not null default 0,
  tasks_completed  integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, date)
);
-- Drives the dashboard heatmap query (last 365 days, per user).
create index if not exists daily_rollups_user_id_date_idx
  on public.daily_rollups (user_id, date);

-- ==========================================================================
-- updated_at trigger
-- ==========================================================================
do $$
declare
  t text;
begin
  t := 'daily_rollups';
  execute format(
    'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
     create trigger trg_%1$s_updated_at
       before update on public.%1$s
       for each row execute function public.set_updated_at();',
    t
  );
end;
$$;

-- ==========================================================================
-- upsert_daily_rollup
-- Atomic INCREMENT (insert or add to existing). Called from the
-- server action recordDailyActivity (app/actions/record-activity.ts)
-- every time useSessionTimer accumulates minutes on a training page.
-- ==========================================================================
create or replace function public.upsert_daily_rollup(
  p_user_id uuid,
  p_date date,
  p_minutes numeric,
  p_tasks_completed integer
) returns void as $$
begin
  insert into public.daily_rollups (user_id, date, minutes, tasks_completed)
  values (p_user_id, p_date, p_minutes, p_tasks_completed)
  on conflict (user_id, date) do update
    set minutes = daily_rollups.minutes + excluded.minutes,
        tasks_completed = daily_rollups.tasks_completed + excluded.tasks_completed;
end;
$$ language plpgsql;

-- ==========================================================================
-- RLS — auth.uid() = user_id
-- ==========================================================================
alter table public.daily_rollups enable row level security;

create policy "daily_rollups_select_own"
  on public.daily_rollups for select
  using (auth.uid() = user_id);
create policy "daily_rollups_insert_own"
  on public.daily_rollups for insert
  with check (auth.uid() = user_id);
create policy "daily_rollups_update_own"
  on public.daily_rollups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "daily_rollups_delete_own"
  on public.daily_rollups for delete
  using (auth.uid() = user_id);

-- ==========================================================================
-- Verify
-- ==========================================================================
-- After running this migration, expect:
--   select tablename, rowsecurity from pg_tables
--   where schemaname='public' and tablename = 'daily_rollups';
-- to show 1 row with rowsecurity = true.
