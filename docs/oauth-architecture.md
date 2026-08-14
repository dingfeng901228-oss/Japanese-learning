# OAuth Architecture (Phase 2 — auth only, data wired in Phase 3)

Shows what's *wired*, what's *prepared*, and what's *not yet* — so Phase 3 knows exactly what to attack next.

---

## What got shipped in Phase 2

```
                  Browser
                  ───────
                  │
                  │ 1. click "Continue with Google"
                  │    <form action={signInWithGoogleAction}>
                  │
                  ▼
   ┌─────────────────────────────────────┐
   │  app/auth/actions.ts                │
   │  (Server Action)                    │
   │  supabase.auth.signInWithOAuth({    │
   │    provider: 'google',              │
   │    options: { redirectTo:           │
   │      '<origin>/auth/callback' }     │
   │  })                                 │
   └─────────────────────────────────────┘
                  │
                  │ 2. Supabase returns the Google OAuth URL
                  │    browser navigates
                  ▼
            accounts.google.com
            (user signs in, grants only
             openid/email/profile scope)
                  │
                  │ 3. Google 302 → redirect back with ?code=…
                  ▼
   ┌─────────────────────────────────────┐
   │  app/auth/callback/route.ts         │
   │  GET /auth/callback?code=…          │
   │  supabase.auth.exchangeCodeForSession(code) │
   │  → sets sb-access-auth + sb-         │
   │    refresh-auth cookies              │
   └─────────────────────────────────────┘
                  │
                  │ 4. 302 → /today (or `redirectTo`)
                  ▼
              Browser now has sb-* cookies.
              Every subsequent fetch from
              @supabase/ssr reads them.

   ┌─────────────────────────────────────┐
   │  next.js middleware.ts               │
   │  runs on /<page> paths that are     │
   │  not /login /auth/* /api/auth,      │
   │  refreshes the session cookie       │
   │  on every request.                   │
   │                                     │
   │  If unauthenticated →               │
   │  302 to /login?redirectTo=<orig>    │
   └─────────────────────────────────────┘
```

## What got *prepared* but is not yet wired

| Prepared                                                | Where                                             | Phase |
|---------------------------------------------------------|---------------------------------------------------|-------|
| Postgres tables (`study_sessions` etc.)              | `supabase/migrations/0001_init.sql`               | Phase 3 |
| RLS policies `auth.uid() = user_id`                   | `supabase/migrations/0002_rls.sql`               | Phase 3 |
| `lib/supabase/client.ts` + `server.ts` + `middleware.ts` | SDK + cookie refresh                              | ready  |
| `UserMenu` (avatar + email + Account / Sign out)        | `components/UserMenu.tsx` + `app/layout.tsx`      | ✅ Phase 4 partial |
| `signOutAction`                                          | `app/auth/actions.ts`                             | ✅ shipped |

## What is **NOT** part of Phase 2

- Migrating `localStorage` data into Supabase — **Phase 3**
- Saving `mistakes` / `shadow_history` to Postgres — **Phase 3**
- Updating `/api/*` to log `user_id` — **Phase 3**
- `/account` page content (only the link is wired; the page itself is 404) — **Phase 4 polish**
- Profile / Settings — explicitly out of scope per docx §10

## Threat-model notes (per docx §14)

- **Client Secret lives only in Supabase.**  Never in the repo, never in a `NEXT_PUBLIC_*` env.
- **OAuth tokens live only in `httpOnly` cookies** (`sb-access-auth`, `sb-refresh-auth`).  `Secure` in prod by Supabase default — never readable from JS.
- **No tokens logged.**  `/auth/callback` on success just `NextResponse.redirect()`s; on failure, redirects to `/login?error=…` with a *code* (not the OAuth state).
- **No tokens in URL.**  We exchange `?code=…` in the route handler (server-side), then drop it from the URL.
- **HTTPS-only in prod** (Vercel default + HSTS preload).
- **RLS = `auth.uid() = user_id`**. Every policy's `using` and `with check` pins the row to the authed user. A manipulated `user_id` from the client fails the `with check`.

## Open questions for future Frank

- Should `/` show the Google button itself, or always redirect → `/today` → middleware bounces to `/login`? (Current: latter.)
- Greeting: should `/today` "Good morning" become "Welcome back, {firstName}"? (Current: unchanged.)
