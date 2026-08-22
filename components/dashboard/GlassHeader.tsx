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
  };
}

export function GlassHeader({ navItems, userInfo }: GlassHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-line">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold text-base text-ink">
          FastStudy
        </Link>
        <TopNav items={navItems} />
        <div className="hidden md:block">
          <UserMenu
            email={userInfo.email}
            displayName={userInfo.displayName}
            avatarUrl={userInfo.avatarUrl}
          />
        </div>
        <MobileNav items={navItems} userInfo={userInfo} />
      </div>
    </header>
  );
}
