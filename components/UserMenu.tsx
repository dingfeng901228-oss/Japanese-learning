"use client";

// Top-right user menu. Visible only when the user is signed in
// (rendered conditionally from app/layout.tsx).
//
// Per docs/requirements2.docx §10 — only Account + Sign out for now;
// Profile / Settings are explicitly "以后再扩展".

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";

export interface UserMenuProps {
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export function UserMenu({ email, displayName, avatarUrl }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click — avoids stale menu if focus drifts.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [open]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }
  }, [open]);

  const fallbackInitial =
    (displayName || email || "?").trim()[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="User menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            // Frank #6731: explicit width/height HTML attributes +
            // matching inline style are a defensive fallback for when
            // Tailwind's `w-7 h-7` fails to apply on Android Chrome.
            // Without these, the <img> renders at Google's natural
            // avatar size (~96px), blowing the UserMenu button up into
            // a huge red "F" card (one of the two visible on Android).
            // Belt-and-suspenders: HTML attr + inline style + className.
            style={{ width: 28, height: 28 }}
            className="w-7 h-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden="true"
            className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-white"
          >
            {fallbackInitial}
          </span>
        )}
        <span className="text-sm text-gray-700 hidden sm:inline max-w-[10rem] truncate">
          {displayName || email}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="text-gray-500 flex-shrink-0"
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="User actions"
          className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <p
              className="text-sm font-medium text-gray-900 truncate"
              title={displayName ?? undefined}
            >
              {displayName || "User"}
            </p>
            <p
              className="text-xs text-gray-500 truncate"
              title={email}
            >
              {email}
            </p>
          </div>
          <div className="py-1">
            <Link
              href="/account"
              role="menuitem"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Account
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
