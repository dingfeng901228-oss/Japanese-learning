# Production Deployment (Vercel)

Verify env vars + build settings on the Vercel project hosting `jp.frank2025.com`.

---

## 1. Vercel Project Settings

1. Vercel project → **Settings** → **Environment Variables**
2. Add (or confirm) for **all three** environments (Production / Preview / Development):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<project-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon key from [supabase-setup.md §2](./supabase-setup.md#2-grab-the-env-vars)
   - `SUPABASE_SERVICE_ROLE_KEY` = the service-role key from [supabase-setup.md §2](./supabase-setup.md#2-grab-the-env-vars) — **no** `NEXT_PUBLIC_` prefix
   - `NEXT_PUBLIC_SITE_URL` = `https://jp.frank2025.com` (prod) /  `http://localhost:3000` (preview — optional)
3. **Do NOT** give the service-role key any `NEXT_PUBLIC_` prefix — it must stay server-side (per docx §14/§15).
4. Save → **Redeploy** the latest commit so the new env takes effect.

## 2. Supabase URL Configuration

Confirm `jp.frank2025.com` is in:

- **Authentication → URL Configuration → Site URL** → `https://jp.frank2025.com`
- **Authentication → URL Configuration → Additional Redirect URLs** → must include:
  - `https://jp.frank2025.com`
  - `https://jp.frank2025.com/auth/callback`

## 3. Google Cloud OAuth Client

In Google Cloud Console → Credentials → your OAuth Client →
both **Authorized JavaScript origins** and **Authorized redirect URIs**
must contain the `https://jp.frank2025.com` variants
(see [google-cloud-setup.md §3](./google-cloud-setup.md#3-create-the-oauth-client-id)).

## 4. First production login

1. Visit <https://jp.frank2025.com/listening>
2. → redirected to `https://jp.frank2025.com/login`
3. Click **Continue with Google**
4. Sign in (must be a test user if Google consent screen is still in Testing mode)
5. Land on `/today` with the UserMenu showing your avatar + email
6. Supabase dashboard → Authentication → Users → your row appears

## 5. Roll-back plan

If production breaks, the auth layer is independent of existing `localStorage` data flow (Phase 3 not wired). Roll back without data loss:

```bash
git revert HEAD~N --no-edit   # N = number of auth commits
vercel --prod                # redeploy pre-auth
```

Existing pages still work anonymously against localStorage (`japanese:shadow-history`, etc.). No data is deleted.

## 6. Monitoring

- 5xx error rate > 0.5% for `/auth/callback` or `/login`
- Function duration p95 > 5s for `/api/auth/callback`
- Bundle size for `/login` > 80 kB (signals you imported a server-only lib in a client component)

## Done

Local + Vercel env set + migrations applied = sign-in-with-Google is live.
