"use client";

// /vocabulary/[id] auto-speak toggle (per Frank #6671, UI优化.docx § 14).
//
// When the toggle is ON, opening a vocab item (or navigating to a
// different one via swipe / prev-next) auto-speaks the word via Web
// Speech API. State persists in localStorage so the user's choice
// carries across sessions.
//
// `hydrated` guard prevents the mount effect from overwriting the
// stored value with the default `true` (same pattern as the /review
// autoplay toggle in commit f921c84).

import { useEffect, useState } from "react";

const AUTOSPEAK_KEY = "japanese:vocab-autospeak";

export function VocabAutoSpeak({ word }: { word: string }) {
  const [enabled, setEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Load stored pref on mount.
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(AUTOSPEAK_KEY) !== "0");
    } catch {
      /* private mode — keep default true */
    }
    setHydrated(true);
  }, []);

  // Persist on change (skip the pre-hydration render so we don't
  // overwrite the stored value with the default `true`).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(AUTOSPEAK_KEY, enabled ? "1" : "0");
    } catch {
      /* quota — silently ignore */
    }
  }, [enabled, hydrated]);

  // Auto-speak on word change when toggle is on.
  useEffect(() => {
    if (!hydrated || !enabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!word) return;
    // Cancel any in-flight utterance (e.g. user clicked a card mid-speak)
    // so the new word doesn't queue behind the old one.
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "ja-JP";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }, [word, enabled, hydrated]);

  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
        className="w-3.5 h-3.5 accent-gray-900"
        aria-label="自动发音"
      />
      自动发音
    </label>
  );
}
