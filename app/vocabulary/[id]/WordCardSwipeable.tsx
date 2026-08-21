"use client";

// WordCardSwipeable — wraps the top word card on /vocabulary/[id] with
// horizontal swipe handlers + a page-turn transition so card-switching
// feels intentional rather than instant.
//
// Per Frank #6607: swipe left/right on the top word card to switch
// between prev/next vocabulary items on mobile (no need to scroll
// down to the bottom navigation cards).
//
// Per Frank #6610: add a page-turn animation when switching cards.
// The flow:
//   1. On swipe, the wrapper slides off-screen in the swipe direction
//      (CSS transition on inline transform, 280ms).
//   2. After the transition, router.push() navigates to the new page.
//   3. The new page mounts and its wrapper runs an entry keyframe
//      (slide-in from right + fade, 280ms).
//
// Detection (unchanged from #6607):
//   - touchstart records finger position
//   - touchend compares deltaX vs deltaY + a 50px threshold
//   - swipe left (dx < -50) → next, swipe right (dx > 50) → prev
//   - only the top word card (<article>) is wrapped — header,
//     example, prev/next preview cards, delete button stay outside
//     the swipe area so vertical scroll and clicks still work
//   - disabled when the user is editing the word (?edit_word=1)
//     and during the exit animation, so a second swipe doesn't
//     trigger mid-transition
//
// Library-free: just React + useRouter + CSS transition + @keyframes.
// Honours prefers-reduced-motion for accessibility.

import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
  type CSSProperties,
} from "react";

const SWIPE_THRESHOLD_PX = 50;
const SLIDE_DURATION_MS = 280;

export interface WordCardSwipeableProps {
  prevId: string | null;
  nextId: string | null;
  disabled?: boolean;
  children: ReactNode;
}

export function WordCardSwipeable({
  prevId,
  nextId,
  disabled = false,
  children,
}: WordCardSwipeableProps) {
  const router = useRouter();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (disabled || exiting) {
      startX.current = null;
      startY.current = null;
      return;
    }
    if (e.touches.length !== 1) {
      // ignore multi-finger (pinch etc.) — would produce ambiguous dx/dy
      startX.current = null;
      startY.current = null;
      return;
    }
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (disabled || exiting) return;
    if (startX.current === null || startY.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX.current;
    const dy = endY - startY.current;
    startX.current = null;
    startY.current = null;

    // Horizontal must dominate vertical, and beyond threshold.
    // |dx| > 50  prevents accidental triggers from small horizontal
    // jitter while the user is doing something else.
    // |dx| > |dy| keeps vertical scrolling working — only true
    // horizontal swipes fire navigation.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dx) <= Math.abs(dy)) return;

    if (dx < 0 && nextId) {
      setExiting("left");
      // Wait SLIDE_DURATION_MS so the slide-out transition completes
      // before Next.js tears down the page. setTimeout is simpler
      // and more reliable than onTransitionEnd here because we want
      // the navigation to happen *after* the visual fade-out, even
      // if the user immediately starts another gesture.
      setTimeout(
        () => router.push(`/vocabulary/${nextId}`),
        SLIDE_DURATION_MS,
      );
    } else if (dx > 0 && prevId) {
      setExiting("right");
      setTimeout(
        () => router.push(`/vocabulary/${prevId}`),
        SLIDE_DURATION_MS,
      );
    }
  }

  const isExiting = exiting !== null;
  const exitStyle: CSSProperties | undefined = isExiting
    ? {
        transform:
          exiting === "left" ? "translateX(-110%)" : "translateX(110%)",
        transition: `transform ${SLIDE_DURATION_MS}ms ease-out, opacity ${SLIDE_DURATION_MS}ms ease-out`,
        opacity: 0,
      }
    : undefined;

  return (
    <>
      <style>{`
        @keyframes vocab-card-enter {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .vocab-card-enter {
          animation: vocab-card-enter ${SLIDE_DURATION_MS}ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .vocab-card-enter {
            animation: none;
          }
        }
      `}</style>
      <div
        className={isExiting ? "" : "vocab-card-enter"}
        style={exitStyle}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </>
  );
}