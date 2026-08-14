// Next.js middleware entry point. Runs on every request that matches
// the `config.matcher` below.
//
//  - Refresh Supabase session cookies (via lib/supabase/middleware.ts)
//  - Redirect unauthenticated users from protected pages to /login
//  - Excludes static assets, image optimization, and API auth routes
//
// See docs/oauth-architecture.md for the full request flow.
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static   (static files emitted by next build)
     *  - _next/image    (image optimization files)
     *  - favicon.ico
     *  - api/auth/*     (handled by its own route handler)
     *  - any direct asset request (svg/png/jpg/jpeg/gif/webp/ico)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
