"use client";

// Reusable nav link with active / hover / pressed states (per Frank
// #6678 UI3.0.docx):
//   - Active: text-ink + font-medium (the 2px indicator line below is
//     rendered by the parent TopNav so it can animate between items).
//   - Hover: text-ink + light bg rgba(15,23,42,0.05) + 150ms color
//     transition. No scale / shadow.
//   - Pressed: translateY(1px) + slightly darker bg (the active:
//     variant in Tailwind gives us the translateY, we use a slightly
//     darker rgba for the press bg).
//   - 8px 10px padding + 6px border-radius per spec §6.
//   - focus-visible: thin ring (not color-only) per spec §9.

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface NavLinkProps {
  href: string;
  label: string;
  isActive: boolean;
  className?: string;
  // For mobile: stack vertically (text-base) vs desktop default
  // (text-[15px]). Default matches the desktop nav.
  size?: "sm" | "md";
}

export function NavLink({
  href,
  label,
  isActive,
  className,
  size = "sm",
}: NavLinkProps) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "px-2.5 py-2 rounded-md transition-colors duration-150",
        "active:translate-y-px",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        isActive
          ? "text-ink font-medium"
          : "text-gray-700 hover:text-ink hover:bg-[rgba(15,23,42,0.05)] active:bg-[rgba(15,23,42,0.08)]",
        size === "md" && "text-base px-3 py-2.5",
        className
      )}
    >
      {label}
    </Link>
  );
}
