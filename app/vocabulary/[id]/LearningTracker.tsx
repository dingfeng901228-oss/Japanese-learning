"use client";

// LearningTracker — invisible side-effect client component that bumps
// vocabulary_items.learning_count when the detail page mounts.
//
// Per Frank #7458 (2026-08-31, docs/vocabuly0831.md follow-up):
//   "打开单词详情页即视为在学习，不需要在详情页中再加个「开始学习」"
//
// The detail page IS the learning surface now — opening it counts as
// studying. The previous [开始学习 →] CTA that navigated to
// /vocabulary/learn (which incremented) is removed; the page-load
// mount itself triggers the increment via this component.
//
// Idempotency: sessionStorage[`vocab_learn_${vocabId}`] = UUID, same
// pattern as app/vocabulary/learn/LearnSession.tsx. Refresh in same
// tab reuses the token → server RPC PK ON CONFLICT catches → no
// double-count. New tab / new day gets a fresh token → +1.
//
// Relationship to /vocabulary/learn: that page no longer increments
// learningCount (see LearnSession.tsx change). It's now purely a
// navigation helper for queue walking. Both pages share the
// `vocab_learn_${vocabId}` sessionStorage key — visiting both within
// the same browser session is treated as ONE learning session
// (matches Frank's intent: one "studying" event per vocab visit burst).

import { useEffect } from "react";
import { startLearningSessionAction } from "@/app/vocabulary/actions";

function getOrCreateSessionToken(vocabId: string): string {
  if (typeof window === "undefined") return "";
  const key = `vocab_learn_${vocabId}`;
  let token = sessionStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    try {
      sessionStorage.setItem(key, token);
    } catch {
      // sessionStorage quota / disabled — degrade. Server-side PK is
      // still the final guard against true duplicates.
    }
  }
  return token;
}

export function LearningTracker({ vocabId }: { vocabId: string }) {
  useEffect(() => {
    const token = getOrCreateSessionToken(vocabId);
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        await startLearningSessionAction({
          vocabId,
          sessionToken: token,
          // No filterContext here — detail page visits don't carry
          // list-page filter state. RPC stores NULL for filter_*,
          // and the COALESCE clause preserves the previously-stored
          // filter (per Q5-α) so the Continue Learning card on
          // /vocabulary still shows the original "原学习类型".
        });
      } catch (err) {
        if (!cancelled) {
          console.error("LearningTracker: start failed", { vocabId, err });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-fire only when vocabId changes. Detail page visits never
    // carry filter context, and re-running on every parent render
    // would call the RPC with the same sessionStorage key
    // (idempotent no-op server-side, but adds latency + log noise).
    // No eslint-disable needed here — vocabId IS the only dep used
    // inside the effect.
  }, [vocabId]);

  // Side effect only — no UI.
  return null;
}