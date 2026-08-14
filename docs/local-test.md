# Local Test — end-to-end Google OAuth flow

Run after [google-cloud-setup.md](./google-cloud-setup.md) + [supabase-setup.md](./supabase-setup.md).

---

## 0. Prerequisites

- Google Cloud OAuth Client configured (per google-cloud-setup.md)
- Supabase project + Google provider enabled (per supabase-setup.md)
- Migrations applied (`0001_init.sql` + `0002_rls.sql`)
- The redirect URI registered in **both** Google Cloud **and** Supabase is `http://localhost:3000/auth/callback`

## 1. Env file

Create `.env.local` at the repo root (gitignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Local only
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 2. Start dev server

```bash
npm install
npm run dev          # http://localhost:3000
```

## 3. Walk through the flow

| Step | URL                                  | Expected                                                              |
|------|--------------------------------------|-----------------------------------------------------------------------|
| 1    | `http://localhost:3000/listening`        | redirected to `/login?redirectTo=/listening`                        |
| 2    | `/login`                            | "FastStudy" header + tagline + `Continue with Google` button only      |
| 3    | click **Continue with Google**       | browser navigates to `accounts.google.com`                            |
| 4    | sign in + consent                   | redirected to `/auth/callback?code=…`                                 |
| 5    | `/auth/callback`                     | redirected to `/today` (or wherever `redirectTo` said)               |
| 6    | top-right header                     | avatar + email + dropdown shows Account / Sign out                   |
| 7    | click **Sign out**                   | redirected to `/login`                                                |
| 8    | visit `/listening` again             | bounced back to `/login?redirectTo=/listening`                        |

## 4. Verify in Supabase

1. Dashboard → **Authentication** → **Users** → your test Google account appears
2. SQL Editor → `select * from auth.sessions limit 5;`
3. Row exists for your session with a valid `not_after`

## 5. Data-isolation check (RLS only — Phase 3 wires page-level user_id)

> Validates RLS even before the page-level injection lands.

1. Insert a row as *user A*:

   ```sql
   insert into public.study_sessions (user_id, title, subject)
   values ('<user-A-uuid>', 'user-A test', 'japanese');
   ```

2. Sign out, sign in as user B → `/today`
3. SQL Editor → `select * from public.study_sessions;` (run as user B)
4. **Should see 0 rows** (RLS hides user A's data)
5. Sign back in as user A → row reappears

If user B can see user A's row → RLS didn't apply → re-check `0002_rls.sql` ran.

## Common errors

| Symptom                                                  | Cause / fix                                                                                              |
|----------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `redirect_uri_mismatch` from Google                      | The callback URL in Google Cloud **≠** the one in Supabase **≠** `NEXT_PUBLIC_SITE_URL/auth/callback`    |
| "Site URL is not allowed" from Supabase                  | `NEXT_PUBLIC_SITE_URL` must be in the Additional Redirect URLs list                                       |
| Infinite loading spinner on /login                       | anon key missing or wrong project                                                                         |
| callback reaches `/login?error=auth-callback-failed`     | the `code` param missing — usually cookies were blocked (try a non-Incognito tab)                         |
| Sign-out button does nothing                             | server action didn't run — check that `app/auth/actions.ts` is `"use server"` at the top                |
| UserMenu doesn't render                                   | layout.tsx edit didn't ship — confirm `app/layout.tsx` imports `createClient` from `@/lib/supabase/server` |

## Next

→ [deploy.md](./deploy.md) once this all passes locally.
