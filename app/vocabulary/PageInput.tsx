"use client";

// PageInput — direct page-number jump input for /vocabulary pagination.
//
// Per docs/vocabuly0831.md §一 (Frank #7397, 2026-08-31):
//   - Enter = navigate immediately
//   - Blur = also navigate (optional, secondary trigger)
//   - Invalid (<1 → 1, >totalPages → totalPages, !Number → restore)
//   - Page state must be in the URL (?page=N) for refresh / back /
//     forward / share-link support
//
// The input is a controlled component that does NOT navigate per
// keystroke (would re-render the whole server component on every
// digit). It commits on Enter or blur — keeps navigation intentional.
//
// State sync: when the URL `?page=N` changes externally (back/forward
// navigation, parent server re-render with new currentPage), we sync
// the input value to the new page so the display stays consistent.
// `lastNavigatedRef` records the page we just navigated to so we can
// distinguish "URL-driven change" from "stale local state".
//
// URL preservation: uses the current searchParams verbatim and only
// mutates `page`, so all active filters (q / type / level / sort)
// carry through to the new page. Same pattern as buildHref() in the
// server component.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  useState,
  useTransition,
  useRef,
  useEffect,
  type KeyboardEvent,
} from "react";

type PageInputProps = {
  currentPage: number;
  totalPages: number;
};

export function PageInput({ currentPage, totalPages }: PageInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [val, setVal] = useState(String(currentPage));
  const [isPending, startTransition] = useTransition();
  const lastNavigatedRef = useRef(currentPage);

  // External URL change (back/forward, server re-render with new page):
  // mirror the new currentPage into the input. We only re-sync if the
  // URL change came from somewhere other than our own jumpTo() — that
  // jumpTo() already updated lastNavigatedRef, so a match means "we did
  // this"; a mismatch means "the URL moved without us".
  useEffect(() => {
    if (currentPage !== lastNavigatedRef.current) {
      setVal(String(currentPage));
      lastNavigatedRef.current = currentPage;
    }
  }, [currentPage]);

  function clamp(n: number): number {
    // Per §一.3: < 1 → 1, > totalPages → totalPages, !Number → caller
    // decides (we restore to currentPage below).
    if (!Number.isFinite(n) || n < 1) return 1;
    if (n > totalPages) return totalPages;
    return n;
  }

  function jumpTo(target: number): void {
    const n = clamp(target);
    if (n === currentPage) {
      // No-op navigation; still sync the input so it reflects the
      // clamped value (e.g. user typed 999 on a 20-page list, we
      // navigate to 20 — input shows 20).
      setVal(String(n));
      return;
    }
    lastNavigatedRef.current = n;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(n));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const n = parseInt(val, 10);
      if (Number.isFinite(n)) {
        jumpTo(n);
      } else {
        // Per §一.3: "abc → 不要执行跳转。恢复当前合法页码。"
        setVal(String(currentPage));
      }
    }
  }

  function handleBlur() {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) {
      // Per §一.3 — restore.
      setVal(String(currentPage));
      return;
    }
    if (n !== currentPage) {
      jumpTo(n);
    }
  }

  // When totalPages is 0 or 1 the input is meaningless — hide it.
  if (totalPages <= 1) {
    return (
      <span className="text-gray-600 tabular-nums">
        第 {currentPage} / {totalPages || 1} 页
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-gray-600">第</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isPending}
        aria-label="跳转到指定页"
        className="w-12 text-center border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-gray-900 tabular-nums disabled:bg-gray-50 disabled:text-gray-400"
      />
      <span className="text-gray-600">/ {totalPages} 页</span>
    </span>
  );
}