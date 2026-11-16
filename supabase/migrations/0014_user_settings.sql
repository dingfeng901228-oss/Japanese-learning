-- 0014_user_settings.sql
-- Audit 2026-11-16 P1-15: there was no settings page at all — the user
-- menu only had Account and Sign out, so there was nowhere to set the
-- daily new-word target or the study goal.
--
-- A tiny key/value table per user. The theme and the speech rate stay
-- in localStorage (they are device preferences); the study goals live
-- here so they follow the user across devices.

create table if not exists public.user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

comment on table public.user_settings is
  'Per-user settings (P1-15). Keys: daily_new_words, daily_review_goal.';

alter table public.user_settings enable row level security;

drop policy if exists "users read own settings" on public.user_settings;
create policy "users read own settings"
  on public.user_settings for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users write own settings" on public.user_settings;
create policy "users write own settings"
  on public.user_settings for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update own settings" on public.user_settings;
create policy "users update own settings"
  on public.user_settings for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own settings" on public.user_settings;
create policy "users delete own settings"
  on public.user_settings for delete to authenticated
  using (auth.uid() = user_id);
