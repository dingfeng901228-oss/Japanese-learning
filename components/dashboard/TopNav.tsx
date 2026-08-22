"use client";

// Desktop top navigation (per Frank #6678 UI3.0.docx).
//
// Renders the nav items + a single absolutely-positioned indicator
// that smoothly slides between the active item on route change.
// Spec §1-4 + §6 + §8-9:
//
//   - Active: text-ink + font-medium (indicator line drawn below by
//     this component, not by NavLink).
//   - Indicator: 2px tall rose-500 bar, ~70% of text width, 2px radius,
//     150-200ms ease-out slide between items.
//   - Hover/pressed: delegated to NavLink.
//   - Click area: NavLink uses 8px 10px padding + 6px radius (per
//     spec §6).
//   - Focus-visible: NavLink renders a thin ring (per spec §9, not
//     color-only).
//
// useLayoutEffect (not useEffect) measures the active link BEFORE
// the browser paints — otherwise the indicator would briefly flash
// at left:0 on every route change. The effect re-runs whenever
// pathname or activeIndex changes.

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "./NavLink";

export function TopNav({
  items,
}: {
  items: Array<{ label: string; href: string }>;
}) {
  const pathname = usePathname();
  const innerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  // Find active index. The home route ("/") must match exactly so
  // it doesn't flag every route as active.
  const activeIndex = items.findIndex((item) => {
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  });

  useLayoutEffect(() => {
    if (activeIndex < 0 || !innerRef.current) return;
    const link = innerRef.current.children[activeIndex] as HTMLElement | undefined;
    if (!link) return;
    const innerRect = innerRef.current.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    // Indicator width = 70% of link width (per spec §1 "指示线宽度
    // 略小于文字宽度"), centered under the link so it visually
    // underlines the text rather than the padded click area.
    const indicatorWidth = linkRect.width * 0.7;
    const left =
      linkRect.left - innerRect.left + (linkRect.width - indicatorWidth) / 2;
    setIndicator({ left, width: indicatorWidth });
  }, [activeIndex, pathname]);

  return (
    <nav
      aria-label="主导航"
      className="hidden md:flex items-center gap-1 text-[15px] relative"
    >
      <div ref={innerRef} className="flex items-center gap-1">
        {items.map((item, idx) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            isActive={idx === activeIndex}
          />
        ))}
      </div>
      {activeIndex >= 0 && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 h-0.5 bg-rose-500 rounded-[2px] pointer-events-none transition-all duration-200 ease-out"
          style={{
            left: `${indicator.left}px`,
            width: `${indicator.width}px`,
          }}
        />
      )}
    </nav>
  );
}
