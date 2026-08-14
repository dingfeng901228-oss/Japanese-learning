# Supabase Project Setup (Phase 2 manual)

One-time manual config for the Supabase half of Google OAuth. Do [google-cloud-setup.md](./google-cloud-setup.md) first.

---

## 1. Create / pick the Supabase Project

1. <https://supabase.com/dashboard> → **New project** (or pick `faststudy`)
2. **Database password**: store in your password manager (needed if you ever psql in)
3. **Region**: same as your Vercel deployment region (ap-southeast-1 for `jp.frank2025.com`)
4. Wait ~2 min for provisioning

## 2. Grab the env vars

1. Sidebar → **Project Settings** → **API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (**server-only**, never `NEXT_PUBLIC_`)
3. Drop these into `.env.local` AND into **Vercel → Project Settings → Environment Variables**

## 3. Enable the Google Auth Provider

1. Sidebar → **Authentication** → **Providers**
2. Find **Google** → toggle **Enable**
3. Paste:
   - **Client ID** (from [google-cloud-setup.md §3](./google-cloud-setup.md#3-create-the-oauth-client-id))
   - **Client Secret** (from same)
4. **Authorized redirect URI** Supabase shows you (looks like `https://<project-ref>.supabase.co/auth/v1/callback`). Copy that exact string and add it to Google Cloud's Authorized redirect URIs (the two **must** match).
5. Save

## 4. Site URL + Additional Redirect URLs

1. Sidebar → **Authentication** → **URL Configuration**
2. **Site URL**: `https://jp.frank2025.com`  (prod)
3. **Additional Redirect URLs** (one per row):
   - `http://localhost:3000`
   - `https://jp.frank2025.com`
   - `https://jp.frank2025.com/auth/callback`
   - `http://localhost:3000/auth/callback`
4. Save

## 5. Run the migrations

Migrations live in [`../supabase/migrations/`](../supabase/migrations). Apply via SQL Editor or CLI.

### Option A — Dashboard SQL Editor (quick, manual)

1. Sidebar → **SQL Editor** → **New query**
2. Paste contents of [`../supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) → **Run**
3. New query → paste [`../supabase/migrations/0002_rls.sql`](../supabase/migrations/0002_rls.sql) → **Run**

### Option B — Supabase CLI (repeatable)

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase db push   # applies all supabase/migrations/*.sql in order
```

> Run `0002_rls.sql` **only after** `0001_init.sql` — RLS policies reference tables that must exist first.

## 6. Verify

1. Sidebar → **Authentication** → **Users** — empty list (no one signed in yet)
2. SQL Editor → `select count(*) from public.study_sessions;` → returns 0
3. SQL Editor →
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname='public';
   ```
   All six tables should return `rowsecurity = true`.

## Security checklist

- [ ] anon key is the only key on a `NEXT_PUBLIC_*` variable
- [ ] `service_role` is server-only (no `NEXT_PUBLIC_` prefix)
- [ ] Site URL is the **prod** domain (not `localhost`)
- [ ] Redirect URLs include both dev + prod
- [ ] All six tables show `rowsecurity = true`

## Next

→ [local-test.md](./local-test.md) — wire env vars in `.env.local` and click through the flow.
