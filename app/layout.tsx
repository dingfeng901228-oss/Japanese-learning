import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP, Noto_Sans_SC } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { GlassHeader } from "@/components/dashboard/GlassHeader";
import { PageTransition } from "@/components/PageTransition";

// Force all routes through this layout to be server-rendered at request
// time. The root layout calls supabase.auth.getUser() which reads session
// cookies via @supabase/ssr createServerClient() — that's a dynamic op
// that fails at build-time static prerendering (Next.js throws
// DYNAMIC_SERVER_USAGE for any route that touches cookies during
// prerender). Cascades to every child route.
// (Originally added in cf4dd63 to fix Vercel build failures.)
export const dynamic = "force-dynamic";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const notoJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-noto-jp",
});

const notoSC = Noto_Sans_SC({
  // Noto Sans SC only exposes cyrillic / latin / latin-ext / vietnamese
  // subsets on Google Fonts — the CJK glyphs ride along in "latin".
  // (next/font hard-requires a subset when preloading is enabled.)
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-noto-sc",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://jp.frank2025.com"),
  title: "FastStudy — 日语学习中心",
  description: "Don't just study Japanese. Use Japanese.",
  applicationName: "FastStudy",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FastStudy",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

const NAV_ITEMS = [
  { label: "学习", href: "/today" },
  { label: "听力", href: "/listening" },
  { label: "口语", href: "/speaking" },
  { label: "跟读", href: "/shadowing" },
  { label: "收藏", href: "/vocabulary" },
  { label: "复习", href: "/review" },
  { label: "进度", href: "/progress" },
];

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
    <html
      lang="zh-CN"
      className={`${inter.variable} ${notoJP.variable} ${notoSC.variable}`}
    >
      <body className="font-sans antialiased min-h-screen bg-soft text-ink">
        {userInfo && <GlassHeader navItems={NAV_ITEMS} userInfo={userInfo} />}
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
