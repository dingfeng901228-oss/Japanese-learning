"use client";

// /vocabulary/[id] click-to-speak wrapper (per Frank #6671,
// UI优化.docx § 15): "单词详情页，点击单词卡片即可朗读。下面例句
// 卡片也是同样，点击例句卡片即可朗读。"
//
// Wraps a card (or any block) so clicking anywhere on it speaks
// the provided text via Web Speech API. Used to wrap the word card
// (speak item.word) and the example card (speak example.sentence).
//
// We re-use the same Web Speech API path as the standalone
// <SpeakButton> component — the existing speak icon still works
// inside the card for users who prefer the visual affordance.
//
// Accessibility: role="button" + tabIndex={0} + Enter/Space keydown
// so the click target is keyboard-navigable.

import { type ReactNode } from "react";

function speakJa(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  // Cancel any in-flight utterance so rapid card-clicks don't queue.
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

export function SpeakableClick({
  text,
  children,
  className = "",
}: {
  text: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      onClick={() => speakJa(text)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          speakJa(text);
        }
      }}
      aria-label="点击朗读"
      className={`cursor-pointer transition-colors ${className}`}
    >
      {children}
    </div>
  );
}
