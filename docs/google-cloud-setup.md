# Google Cloud Console — OAuth Client Setup (Phase 2 manual)

One-time manual config that Frank must complete before Google sign-in works end-to-end.
No code change can complete this — Google + Supabase require credentials only the project owner can mint.

---

## 1. Create / pick a Google Cloud Project

1. Open <https://console.cloud.google.com>
2. Project picker → **New Project** (or pick existing, e.g. `fast-study`)
3. Note the **Project ID** (`GOOGLE_PROJECT_ID` if needed downstream)

## 2. Configure the OAuth Consent Screen

> Required before you can create an OAuth Client.

1. Sidebar → **APIs & Services** → **OAuth consent screen**
2. User type: pick **External** (unless Workspace allows Internal-only)
3. Fill in:
   - **App name**: `FastStudy`
   - **User support email**: your email
   - **Developer contact email**: your email
4. **Scopes**: only request what we need (per docx §12):
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - **Do NOT** request `drive`, `gmail`, `calendar`, etc. — sign-in only.
5. **Test users** (while in testing): add the Google accounts you'll sign in with
6. Save

## 3. Create the OAuth Client ID

1. Sidebar → **APIs & Services** → **Credentials**
2. **Create credentials** → **OAuth client ID**
3. **Application type**: **Web application**
4. **Name**: `FastStudy Web`
5. **Authorized JavaScript origins** (one per row):
   - `http://localhost:3000`               (dev)
   - `https://jp.frank2025.com`            (prod)
6. **Authorized redirect URIs** — **must** match what Supabase tells you:
   - Dev:   `http://localhost:3000/auth/callback`
   - Prod:  `https://jp.frank2025.com/auth/callback`
   - These come from the Supabase dashboard (see [supabase-setup.md §3](./supabase-setup.md#3-enable-the-google-auth-provider)). The two ends **must** match.
7. **Create**
8. Copy **Client ID** + **Client Secret** → paste into the Supabase Google provider config (next file). Do NOT commit them.

## 4. Publish the consent screen (when ready for real users)

While in development you can keep the app in **Testing** mode and rely on the test-user list. To accept real users:

1. OAuth consent screen → **Publish App**
2. Confirm "push to production" — Google only requires verification for sensitive scopes (we request none, so it stays self-certified)

## Security checklist

- [ ] Only `openid` + `email` + `profile` scopes (no Drive / Gmail / Calendar)
- [ ] Client Secret never committed to git or shipped to a `NEXT_PUBLIC_*` env
- [ ] Redirect URIs in Google Cloud match Supabase (otherwise `redirect_uri_mismatch`)
- [ ] Test users added while in Testing mode
- [ ] JavaScript origins cover both dev + prod, nothing more

## Next

→ [supabase-setup.md](./supabase-setup.md) — paste the Client ID + Secret there.
