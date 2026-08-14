import type { Metadata, Viewport } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/UserMenu";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userInfo = user
    ? {
        email: user.email ?? "",
        displayName:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
        avatarUrl:
          (user.user_metadata?.avatar_url as string | undefined) ??
          (user.user_metadata?.picture as string | undefined) ??
          null,
      }
    : null;

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
