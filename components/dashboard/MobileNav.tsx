"use client";

// Mobile hamburger menu — spec §22.
// md:hidden wrapper keeps it off desktop. Includes its own UserMenu
// (the desktop nav has its own). Outside-click + Escape close.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";

export interface MobileNavProps {
  items: Array<{ label: string; href: string }>;
  userInfo: {
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export function MobileNav({ items, userInfo }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div className="md:hidden" ref={ref}>
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
        <div className="absolute left-0 right-0 top-16 bg-white border-b border-line shadow-md z-40">
          <nav className="px-6 py-4 flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-base transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
