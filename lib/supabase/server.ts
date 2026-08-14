// Server-only Supabase client. Used by:
//  - Server Components (layout.tsx, page.tsx children)
//  - Route Handlers (app/auth/callback/route.ts)
//  - Server Actions (app/auth/actions.ts)
//
// Reads session cookies via next/headers.  Cookie *writes* in a
// Server Component are silently ignored — that's why we have a
// separate middleware.ts that refreshes cookies on the request.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
