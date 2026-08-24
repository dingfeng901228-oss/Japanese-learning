"use server";

// Server actions for Google OAuth sign-in / sign-out.
// Driven entirely through Supabase Auth — no direct calls to Google.
//
// Flow recap (see docs/oauth-architecture.md for the full diagram):
//  1. signInWithGoogleAction() — asks Supabase for an OAuth URL, then
//     redirects the browser to Google.
//  2. Google bounces back to /auth/callback?code=…
//  3. supabase.auth.exchangeCodeForSession(code) sets sb-* cookies.
//  4. /auth/callback redirects to /. Was /today before Frank #6767
//     — /today route removed by Frank #6671 (UI优化.docx).
//
// next/navigation's `redirect()` throws — do NOT wrap it in a try/catch
// that swallows errors, or you'll break the redirect.
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function signInWithGoogleAction() {
  const supabase = await createClient();
  const headerList = await headers();
  const origin = resolveOriginOrThrow(headerList);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    redirect("/login?error=oauth_failed");
  }

  if (data?.url) {
    redirect(data.url);
  }

  redirect("/login?error=oauth_failed");
}

export async function signInWithMagicLinkAction(formData: FormData) {
  const supabase = await createClient();
  const headerList = await headers();
  const origin = resolveOriginOrThrow(headerList);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Server-side format check — never trust the client alone.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/login?error=invalid_email");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    // Don't expose Supabase's error string — could leak which emails are
    // registered (user-enumeration). Same generic message for any failure.
    redirect("/login?error=magic_link_failed");
  }

  // No code URL like OAuth — Supabase sends an email with the link.
  // Surface "check your inbox" via a success query param so the login
  // page can render a confirmation without a flash of blank state.
  redirect(`/login?success=magic_link_sent&email=${encodeURIComponent(email)}`);
}

export async function signOutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    // Stay on current page; surface a non-fatal hint via redirect.
    redirect("/?error=signout_failed");
  }
  redirect("/login");
}

// Resolve the public site origin for OAuth / magic-link redirect targets.
// Order:
//   1. NEXT_PUBLIC_SITE_URL — explicit env var (set in Vercel Project Settings)
//   2. request Origin header — set by the incoming HTTP request
// Never fall back to localhost — that's the bug that produced magic-link
// emails pointing at the dev machine (Supabase ignores emailRedirectTo
// when Site URL is localhost and substitutes its own value into the
// email template's {{ .ConfirmationURL }}).
function resolveOriginOrThrow(headerList: Awaited<ReturnType<typeof headers>>) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    headerList.get("origin");
  if (!origin) {
    throw new Error(
      "auth: cannot determine site origin. Set NEXT_PUBLIC_SITE_URL " +
        "(e.g. https://jp.frank2025.com) in Vercel Project Settings.",
    );
  }
  return origin;
}
