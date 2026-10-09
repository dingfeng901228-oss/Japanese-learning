// Server-only Supabase client. Used by:
//   - Server Components (layout.tsx, page.tsx children)
//   - Route Handlers (app/auth/callback/route.ts)
//   - Server Actions (app/auth/actions.ts)
//
// Reads session cookies via next/headers.  Cookie *writes* in a
// Server Component are silently ignored — that's why we have a
// separate middleware.ts that refreshes cookies on the request.
//
// Audit 2026-10-09: when NEXT_PUBLIC_SUPABASE_URL / _KEY are missing
// (local dev without .env, or a fresh clone), every page hit logged
// "Your project's URL and Key are required to create a Supabase client"
// because the env-vars were typed `!` and the underlying SDK throws
// before our caller-side try/catch could quiet it.  Now we throw a
// single short marker error — same shape as the SDK's throw, but our
// callers' try/catch (which already exists in layout.tsx, page.tsx,
// and every dashboard component) catches it identically.  The shorter
// message keeps the log readable.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("supabase_env_missing");
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware will refresh
            // the session on the next request, so this is a no-op.
          }
        },
      },
    },
  );
}
