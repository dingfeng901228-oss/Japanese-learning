"use client";

// Mobile hamburger menu — Frank #6678 UI3.0.docx revamp:
//   - md:hidden wrapper keeps it off desktop. Includes its own UserMenu
//     (the desktop nav has its own). Outside-click + Escape close.
//   - Nav items use <NavLink size="md"> for active/hover/pressed
//     states — same logic as desktop, just bigger text per the
//     existing mobile styling.
//   - The desktop bottom-indicator line doesn't make sense in a
//     vertical stack, so the active state is communicated purely
//     through text color + weight (text-ink + font-medium). The
//     same affordance works in the vertical mobile layout.
//   - Sheet still closes on link click (existing behavior).

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/UserMenu";
import { NavLink } from "./NavLink";

export interface MobileNavProps {
  items: Array<{ label: string; href: string }>;
  userInfo: {
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export function MobileNav({ items, userInfo }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the sheet automatically on route change (covers the
  // back/forward browser nav, not just clicks on a NavLink).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    // Frank #6731: `mobile-show-only` is a defensive fallback for
    // when Tailwind's `md:hidden` doesn't apply on Android Chrome.
    // See globals.css for the matching media-query rule. Without
    // this, MobileNav rendered on desktop too — producing a second
    // UserMenu card AND a duplicate hamburger button next to the
    // desktop nav.
    <div className="md:hidden mobile-show-only" ref={ref}>
      <div className="flex items-center gap-2">
        <UserMenu
          email={userInfo.email}
          displayName={userInfo.displayName}
          avatarUrl={userInfo.avatarUrl}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Menu"
          aria-expanded={open}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            {open ? (
              <path
                d="M5 5l10 10M5 15L15 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <>
                <path
                  d="M3 6h14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M3 10h14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M3 14h14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-16 bg-white border-b border-line z-40">
          <nav
            aria-label="主导航"
            className="px-6 py-4 flex flex-col gap-1"
          >
            {items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(item.href + "/");
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  isActive={isActive}
                  size="md"
                  className="w-full"
                />
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
