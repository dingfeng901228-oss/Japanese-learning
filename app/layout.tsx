import type { Metadata, Viewport } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/UserMenu";

// Force all routes through this layout to be server-rendered at request
// time. The root layout calls supabase.auth.getUser() which reads session
// cookies via @supabase/ssr createServerClient() — that's a dynamic op
// that fails at build-time static prerendering (Next.js throws
// DYNAMIC_SERVER_USAGE for any route that touches cookies during
// prerender). Adding this here cascades the dynamic flag to every child
// route (/, /login, /today, /listening, /speaking, /progress,
// /auth/callback, etc.).
//
// Trade-off: no static optimization for these routes, but they're all
// auth-gated anyway, so SSR is the right rendering mode.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
};

export const metadata: Metadata = {
  title: "FastStudy 2.0 — AI 日语口语教练",
  description: "Don't just study Japanese. Use Japanese.",
  applicationName: "FastStudy 2.0",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FastStudy 2.0",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

// Server Component: pulls the current Supabase user out of the session
// cookies (set by middleware.ts on every request) and passes the relevant
// fields to the (client) UserMenu. If unauthenticated, the header is
// hidden entirely and the protected pages will redirect to /login.
//
// Phase 2 only — Phase 3 will inject `user_id` into the page-level data
// writes that are still backed by localStorage today.
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // If Supabase isn't configured (e.g. Vercel env vars not yet set),
  // we skip the user fetch and render the page without the UserMenu.
  // Once NEXT_PUBLIC_SUPABASE_URL + _KEY are present, the UserMenu
  // appears for signed-in users.
  //
  // Wrapped in try/catch so a Supabase outage can't crash the whole
  // page (the crash would surface as a Server Component error that
  // Next.js renders via the error boundary, not a 500).
  let userInfo: {
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userInfo = {
        email: user.email ?? "",
        displayName:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
        avatarUrl:
          (user.user_metadata?.avatar_url as string | undefined) ??
          (user.user_metadata?.picture as string | undefined) ??
          null,
      };
    }
  } catch (err) {
    // Supabase unavailable (env vars missing, network down, etc.) —
    // render without UserMenu instead of crashing the whole page.
    console.error("[root layout] failed to load user:", err);
  }

  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen bg-gradient-to-b from-white to-gray-50 text-gray-900">
        {userInfo && (
          <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-200">
            <div className="max-w-3xl mx-auto px-6 py-3 flex justify-end">
              <UserMenu
                email={userInfo.email}
                displayName={userInfo.displayName}
                avatarUrl={userInfo.avatarUrl}
              />
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
