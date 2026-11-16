-- 0011_admin_access.sql
-- Audit 2026-11-16 P1-16: /admin/import-vocab was behind the login
-- gate only. Any signed-in account could open the bulk-import page and
-- POST to its server actions — the import writes into the CALLER's own
-- rows (RLS scopes inserts to auth.uid()), so the damage was limited
-- to their own collection, but a normal account has no business in
-- the admin tooling at all.
--
-- This adds an explicit allow-list. Frank's account is inserted below;
-- every other account is an ordinary user and is refused.
--
-- The check is a SECURITY DEFINER function rather than a plain table
-- read, so RLS on app_admins cannot recurse into itself.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.app_admins is
  'Accounts allowed to use /admin/* tooling. Reviewed 2026-11-16.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.app_admins enable row level security;

drop policy if exists "admins may read app_admins" on public.app_admins;
create policy "admins may read app_admins"
  on public.app_admins
  for select
  to authenticated
  using (public.is_admin());

-- Frank's account. The second account on this project
-- (dingfeng901112@gmail.com) is deliberately NOT listed — it is the
-- "普通账号" case the audit asked to be blocked.
insert into public.app_admins (user_id, email, note)
values (
  '904709f5-44ba-4ddf-b945-503630d3dfd2',
  'dingfeng901228@gmail.com',
  'owner of the jp.frank2025.com collection'
)
on conflict (user_id) do update set email = excluded.email;
