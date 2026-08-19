"use client";

// GlassHeader — extracted from app/layout.tsx to host the scroll listener
// that deepens the navbar shadow once the user scrolls past 10px.
//
// Background is a subtle vertical gradient (more transparent at the
// bottom) with a heavy backdrop-blur — the spec §21 "no glassmorphism"
// rule is overridden by Frank 2026-08-19 #6214, and made more
// pronounced in #6217.

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/dashboard/MobileNav";

export interface GlassHeaderProps {
  navItems: Array<{ label: string; href: string }>;
  userInfo: {
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export function GlassHeader({ navItems, userInfo }: GlassHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 border-b border-line transition-shadow duration-200 ease-out ${
        scrolled
          ? "bg-gradient-to-b from-white/60 to-white/40 backdrop-blur-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
          : "bg-gradient-to-b from-white/60 to-white/40 backdrop-blur-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold text-base text-ink">
          FastStudy
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-[15px]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
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
