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
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/today";

  // Magic link / email OTP: Supabase emails a URL like
  // /auth/callback?token_hash=***&type=magiclink.
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email" | "recovery" | "invite",
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

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
