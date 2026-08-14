// Middleware helper that refreshes the Supabase session cookie on every
// request that matches the middleware matcher in /middleware.ts.
//
// Why this lives separately from `middleware.ts`:
//  - keeps the file colocated with the other supabase SDK files
//  - lets us swap the auth strategy in one place later
//    (e.g. add custom claims, downgrade to anon-only on public routes, etc.)
//
// Phase 2 route protection rule (per docs/requirements2.docx §17):
//   Unauthenticated access to a page route → redirect to /login.
//   API routes opt out — they each decide for themselves (most stay
//   open in Phase 2; Phase 3 will inject user_id).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/listening",
  "/speaking",
  "/today",
  "/progress",
] as const;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // request cookies (for downstream reads in this request)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // response cookies (sent back to the browser)
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not move this `getUser()` into a try/catch wrapper.
  // Throwing here breaks the entire middleware.  If it ever errors,
  // surface the error to the logs instead of swallowing.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Bounce already-signed-in users away from /login.
  if (user && (pathname === "/login" || pathname === "/signin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    url.searchParams.delete("redirectTo");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
