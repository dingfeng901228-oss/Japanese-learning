"use client";

/**
 * The light / dark / system theme.
 *
 * Audit 2026-11-16 P1-15: the site had no dark mode. The palette is
 * remapped by the generated CSS layer in app/globals.css (see
 * scripts/gen-dark-theme.py) — with `.dark` on <html>, `bg-white`
 * becomes the dark surface.
 *
 * The choice is kept in localStorage and applied by a tiny inline
 * script in the root layout BEFORE the first paint, so the page never
 * flashes white on the way to dark.
 */

import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "jp_theme";

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return systemPrefersDark();
}

export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // private mode
  }
  return "system";
}

/** Put the theme on <html>. Safe to call on the server (no-op). */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(theme));
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // private mode — the theme still applies for this page view.
  }
}

export function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getTheme());
    setMounted(true);

    // Follow the OS while the theme is "system".
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <label className={`inline-flex items-center gap-1.5 text-sm ${className}`}>
      <span className="sr-only">主题</span>
      <select
        value={theme}
        onChange={(e) => {
          const next = e.target.value as Theme;
          setTheme(next);
          applyTheme(next);
        }}
        aria-label="主题"
        disabled={!mounted}
        className="px-2 py-1 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm disabled:opacity-50"
      >
        {THEME_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
