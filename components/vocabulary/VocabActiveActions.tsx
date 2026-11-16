"use client";

/**
 * VocabActiveActions — the buttons on the vocabulary detail page that
 * count as ACTIVE study.
 *
 * Audit 2026-11-16 P0-3. Before this, opening the detail page bumped
 * vocabulary_items.learning_count by itself (LearningTracker fired on
 * mount) and the 5s learning-time bar filled from passive dwell — so
 * "学习次数" climbed while the user was only reading, and the page could
 * show "学习次数 0 次 / 复习次数 1 次" for a word the user had never
 * actually reviewed.
 *
 * The rule now: only a deliberate action counts.
 *   点朗读  — the speaker button (or the card click, which speaks)
 *   手动标记 — the 标记已学 button
 *   (复习答题并评分 counts too — that lives in /review.)
 *
 * Each action type gets its own idempotency token, so one action per
 * type per tab per word is recorded. The server RPC
 * (start_learning_session, migration 0007) de-duplicates on the token,
 * so re-clicking the same button in the same tab does not inflate the
 * counter, while a new tab or a new day does count again.
 */

import { useCallback, useState } from "react";
import { startLearningSessionAction } from "@/app/vocabulary/actions";

export type ActiveAction = "speak" | "mark";

/**
 * Fired on the window when the user does something deliberate with a
 * word. The learning-time bar (VocabLearningProgress) listens for it so
 * the 5s counter only starts once the user is actually engaged —
 * audit 2026-11-16 P0-3.
 */
export const VOCAB_ACTIVE_ACTION_EVENT = "vocab:active-action";

export function announceActiveAction(vocabId: string, action: ActiveAction) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(VOCAB_ACTIVE_ACTION_EVENT, {
      detail: { vocabId, action },
    })
  );
}

function tokenKey(vocabId: string, action: ActiveAction): string {
  return `vocab_active_${action}_${vocabId}`;
}

/**
 * Record an active study action for a word. Safe to call from any
 * client component; failures are logged but never break the UI.
 */
export function useActiveAction(vocabId: string) {
  return useCallback(
    async (action: ActiveAction) => {
      if (typeof window === "undefined") return;
      const key = tokenKey(vocabId, action);
      let token = sessionStorage.getItem(key);
      if (!token) {
        token = crypto.randomUUID();
        try {
          sessionStorage.setItem(key, token);
        } catch {
          // sessionStorage unavailable (private mode) — the RPC will
          // still record, it just can't be de-duplicated.
        }
      }
      try {
        await startLearningSessionAction({ vocabId, sessionToken: token });
      } catch (err) {
        console.error("VocabActiveActions: could not record action", {
          vocabId,
          action,
          err,
        });
      }
      // Let the learning-time bar know the user is engaged with this
      // word — until then the 5s counter stays at 0.
      announceActiveAction(vocabId, action);
    },
    [vocabId]
  );
}

function speakJa(text: string, rate = 0.9) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

/**
 * The speaker button for the word. Clicking it speaks the word AND
 * records an active "speak" action.
 */
export function VocabSpeakButton({
  vocabId,
  text,
  label = "朗读",
  className = "",
}: {
  vocabId: string;
  text: string;
  label?: string;
  className?: string;
}) {
  const record = useActiveAction(vocabId);

  function handleClick() {
    if (!text) return;
    speakJa(text);
    void record("speak");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={`p-1 rounded hover:bg-gray-100 transition-colors ${className}`}
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}

/**
 * A small speaker for the reading (kana). Reading the kana out loud
 * is what a learner actually does, and it reflects any reading
 * correction immediately.
 */
export function VocabReadingSpeakButton({
  vocabId,
  reading,
}: {
  vocabId: string;
  reading: string;
}) {
  const record = useActiveAction(vocabId);

  function handleClick() {
    if (!reading) return;
    speakJa(reading);
    void record("speak");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="朗读读音"
      title="朗读读音"
      className="text-xs text-gray-400 hover:text-gray-700 px-1 rounded transition-colors"
    >
      <span aria-hidden="true">🔈</span>
    </button>
  );
}

/**
 * 标记已学 — an explicit "I have studied this" mark. Counts as an
 * active action (it bumps 学习次数 through the same RPC).
 */
export function VocabMarkStudiedButton({
  vocabId,
}: {
  vocabId: string;
}) {
  const record = useActiveAction(vocabId);
  const [marked, setMarked] = useState(false);

  async function handleClick() {
    await record("mark");
    setMarked(true);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={marked}
      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
        marked
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
      title="手动标记「已学」，会计入学习次数"
    >
      {marked ? "✓ 已标记" : "标记已学"}
    </button>
  );
}
