"use client";

// P1.B follow-up #2 — lightweight Tooltip primitive.
//
// Why roll-your-own:
// - No Radix UI / Headless UI / shadcn in the project's dep tree
//   (kept that way deliberately — keeping the bundle tight on Vercel Hobby).
// - Only needed for two surfaces right now (kanji-reading mismatch hints
//   + structured-issue chips on the listening result card). No need for
//   portals, collision detection, or animation — a `<span>` with
//   `position: absolute` + hover/focus state is enough.
//
// Accessibility:
// - Renders `role="tooltip"` so screen readers announce it.
// - Shows on mouseenter + focus (keyboard users get the hint via Tab).
// - `pointer-events-none` keeps the tooltip from intercepting clicks
//   on the trigger underneath.
// - `whitespace-nowrap` prevents multi-line wrapping inside a small
//   chip; callers needing wrap can pass `content` as a wider JSX node.

import { useState, type ReactNode } from "react";

type TooltipSide = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  /** The text / element rendered inside the floating tooltip bubble. */
  content: ReactNode;
  /** The element the tooltip is attached to. */
  children: ReactNode;
  /** Which side of the trigger the tooltip appears on. Default `top`. */
  side?: TooltipSide;
  /** Extra classes merged into the trigger wrapper (use `inline-block`,
   *  `flex`, etc. to override the default `inline-flex`). */
  className?: string;
};

const POSITION_CLASSES: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const ARROW_CLASSES: Record<TooltipSide, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-zinc-900",
  bottom:
    "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-zinc-900",
  left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-zinc-900",
  right:
    "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-zinc-900",
};

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className={`relative inline-flex ${className ?? ""}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-zinc-900 rounded shadow-lg whitespace-nowrap pointer-events-none ${POSITION_CLASSES[side]}`}
        >
          {content}
          <span
            aria-hidden="true"
            className={`absolute w-0 h-0 border-4 ${ARROW_CLASSES[side]}`}
          />
        </span>
      )}
    </span>
  );
}