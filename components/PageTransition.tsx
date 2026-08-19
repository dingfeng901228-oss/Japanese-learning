"use client";

// Page transition wrapper — per Frank #6300. iOS-style fade + slight
// upward slide on every route change. Each new pathname re-mounts the
// children via `key={pathname}`, which restarts the CSS animation
// (`.page-enter` keyframe in app/globals.css) so the effect plays every
// time the user navigates between /today, /listening, /speaking, etc.
//
// The navbar (GlassHeader) is rendered above this in the body, so it
// stays static — matches iOS Safari's behavior where the bottom tab bar
// / top bar doesn't animate on push navigation.

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
