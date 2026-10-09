"use client";

// GlassHeader — Frank #6678 UI3.0.docx revamp:
//   - Solid white bg (no gradient, no shadow, no backdrop-blur) per
//     spec §7 "保持当前白色背景和底部细分割线。不要增加阴影。不要
//     增加渐变。" — this reverses the #6214/#6217 glassmorphism
//     override and goes back to the spec §21 "no glassmorphism" rule.
//   - Scroll listener removed (no more shadow deepening on scroll).
//   - Nav replaced by <TopNav> for active-state indicator + smooth
//     slide between items (see TopNav.tsx for the animation logic).
//   - Header height (h-16) + layout (logo left / nav center / user
//     menu right) unchanged per spec §5.

import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { TopNav } from "@/components/dashboard/TopNav";

export interface GlassHeaderProps {
  navItems: Array<{ label: string; href: string }>;
  userInfo: {
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

export function GlassHeader({ navItems, userInfo }: GlassHeaderProps) {
  // Per audit 2026-10-09 P0-1: anonymous visitors get a "登录" CTA on the
  // right instead of the UserMenu + horizontal nav. The horizontal nav
  // still renders on desktop (so signed-in users see no change), but for
  // signed-out users the items aren't useful since they all bounce to
  // /login — we hide the desktop nav when userInfo is null. Mobile menu
  // also skips nav items in that case and just shows the Login link.
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-line">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold text-base text-ink">
          FastStudy
        </Link>
        {/* Frank #6731: wrap TopNav in a defensive div carrying
            `hidden md:block md-show-only`. The wrapper exists because
            TopNav doesn't accept className. `md-show-only` is a
            globals.css fallback that hides the wrapper on mobile if
            Tailwind's `hidden md:block` doesn't apply on Android
            Chrome (observed bug: all three header elements rendered
            at once, producing 2× UserMenu cards). */}
        {userInfo && (
          <div className="hidden md:block md-show-only">
            <TopNav items={navItems} />
          </div>
        )}
        {userInfo ? (
          <div className="hidden md:block md-show-only">
            <UserMenu
              email={userInfo.email}
              displayName={userInfo.displayName}
              avatarUrl={userInfo.avatarUrl}
            />
          </div>
        ) : (
          <Link
            href="/login"
            className="hidden md:inline-flex items-center justify-center h-9 px-4 rounded-lg bg-ink text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            登录
          </Link>
        )}
        <MobileNav items={navItems} userInfo={userInfo} />
      </div>
    </header>
  );
}
