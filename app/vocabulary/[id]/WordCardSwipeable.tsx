"use client";

// WordCardSwipeable — wraps the top word card on /vocabulary/[id] with
// horizontal swipe handlers so mobile users can navigate between prev
// and next vocabulary items without scrolling. Server-side prev/next
// neighbours are passed in (already computed by page.tsx via
// listVocabularyItems).
//
// Detection (per Frank #6607):
//   - touchstart records finger position
//   - touchend compares deltaX vs deltaY + a 50px threshold so it
//     doesn't fire on accidental taps, small horizontal jitter, or
//     near-vertical scrolls.
//   - swipe left (deltaX < -50) → next item, swipe right (deltaX > 50)
//     → prev item
//   - only the top word card (<article>) is wrapped — header, example,
//     prev/next preview cards at the bottom, and delete button are all
//     outside the swipe area so vertical scroll and clicks still work
//   - disabled when the user is editing the word (?edit_word=1) so
//     a swipe doesn't yank them out of a form they're filling in
//
// Library-free: just React + useRouter. No animated slide transition
// in v1 — router.push() is instantaneous, which matches the existing
// prev/next Link clicks at the bottom of the page.

import { useRouter } from "next/navigation";
import { useRef, type ReactNode, type TouchEvent } from "react";

const SWIPE_THRESHOLD_PX = 50;

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

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (disabled) {
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
    if (disabled) return;
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
      router.push(`/vocabulary/${nextId}`);
    } else if (dx > 0 && prevId) {
      router.push(`/vocabulary/${prevId}`);
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {children}
    </div>
  );
}