// OAuth callback handler. Exchanges the `?code=` from Google for a
// Supabase session (which sets sb-access-auth + sb-refresh-auth
// cookies), then redirects to the page that originally requested login.
//
// If anything goes wrong (missing code, exchange failure) we redirect
// to /login with a stable error code — never leak OAuth state into the
// URL after a successful exchange (per requirements2.docx §14).
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/today";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth-callback-failed", origin),
  );
}
