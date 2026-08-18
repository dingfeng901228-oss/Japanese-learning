"use server";

// Server actions for Google OAuth sign-in / sign-out.
// Driven entirely through Supabase Auth — no direct calls to Google.
//
// Flow recap (see docs/oauth-architecture.md for the full diagram):
//  1. signInWithGoogleAction() — asks Supabase for an OAuth URL, then
//     redirects the browser to Google.
//  2. Google bounces back to /auth/callback?code=…
//  3. supabase.auth.exchangeCodeForSession(code) sets sb-* cookies.
//  4. /auth/callback redirects to /today.
//
// next/navigation's `redirect()` throws — do NOT wrap it in a try/catch
// that swallows errors, or you'll break the redirect.
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function signInWithGoogleAction() {
  const supabase = await createClient();
  const headerList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    headerList.get("origin") ??
    "http://localhost:3000";

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
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    headerList.get("origin") ??
    "http://localhost:3000";

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
