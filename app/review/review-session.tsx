"use client";

// /review — single recall flow (per docs/review.docx).
//
// Frank #6663 redesign replaces the old fill-in (4 multiple-choice) +
// dictation (TTS-only) two-mode UI with one state machine:
//
//   QUIZ            → target blanked, full reading + Chinese + 🔊, [显示单词]
//   ANSWER_REVEALED → full sentence (target bolded) + reading + Chinese +
//                     🔊, [再来一次] [记住了]
//
// Key design points from the doc:
//   §3 — full sentence reading always visible (never blanked)
//   §4 — Chinese translation always visible (no toggle button)
//   §6 — auto-play TTS on new question entry (toggleable inline)
//   §7 + §16 — large Japanese + medium reading/Chinese + lots of
//              whitespace, minimal chrome, no complex cards
//   §8 — target word font-weight: 700 in ANSWER_REVEALED
//   §10 — bottom buttons [再来一次] (rating=again) / [记住了]
//          (rating=remembered)
//   §11 — reading must ALWAYS be complete, never blanked (critical,
//          differentiates this mode from ordinary flashcards)
//   §12 — different blank strategies for 单词/动词/形容词/固定搭配/词组
//
// SRS rating simplified from easy/medium/hard → remembered/again
// (SM-2 quality 5 / 2). See lib/vocabulary/reviews.ts recordReview().

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { ReviewItem } from "@/lib/vocabulary/reviews";
import { recordReviewAction } from "./actions";
import { useSessionTimer, formatDuration } from "@/lib/today-stats";

const AUTOPLAY_KEY = "japanese:review-autoplay";
// Per docs §2 example: 6 全角横线 (Japanese-style underscore). One
// character shorter than ＿＿＿＿ to keep the visual rhythm but still
// reads as "blank" at sentence scale.
const BLANK = "＿＿＿＿";

function speakJa(text: string | null | undefined) {
  if (!text || typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  // Cancel any in-flight utterance so rapid "再听一次" clicks don't
  // queue up. Web Speech API is single-track — overlapping speak() calls
  // get dropped silently otherwise.
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "ja-JP";
  utt.rate = 0.9;
  window.speechSynthesis.speak(utt);
}

function loadAutoplayPref(): boolean {
  if (typeof window === "undefined") return true; // default on
  try {
    return window.localStorage.getItem(AUTOPLAY_KEY) !== "0";
  } catch {
    return true;
  }
}

function saveAutoplayPref(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTOPLAY_KEY, on ? "1" : "0");
  } catch {
    /* private mode / quota — silently ignore */
  }
}

/**
 * Blank the target word in the example sentence.
 *
 * Per Frank #6663 choice C1 (simple substring match). The vocab data
 * stores the EXACT form to blank (§13 "必须根据 Vocabulary 中保存的
 * 目标词精确匹配"): 动词 stores the conjugated form (e.g. "歩きます"),
 * 形容词 stores the stem (e.g. "難しい"), 固定搭配 stores the full
 * phrase (e.g. "頭を抱える"). Single substring split covers all 5
 * word types in §12 if data is consistent.
 *
 * Fallback chain (data inconsistent defense):
 *   1) primary: example.split(target).join(BLANK)
 *   2) longest suffix substring match (handles minor inflection
 *      variation, e.g. if target was "難しい" but sentence has "難しく")
 *   3) last resort: return unchanged (target shown normally — user
 *      still sees the word but no blank)
 */
function blankTarget(example: string, target: string): string {
  if (!target || !example) return example;
  if (example.includes(target)) {
    return example.split(target).join(BLANK);
  }
  for (let len = target.length - 1; len >= 2; len--) {
    const suffix = target.slice(-len);
    if (example.includes(suffix)) {
      return example.split(suffix).join(BLANK);
    }
  }
  return example;
}

/**
 * Render sentence with target word bolded (font-weight: 700, §8).
 * Used in ANSWER_REVEALED phase. No fallback to "rendered plain" — if
 * data is inconsistent and target isn't in example, render the full
 * sentence plain (caller handles fallback via blankTarget).
 */
function renderWithBoldTarget(
  example: string,
  target: string
): React.ReactNode {
  if (!target || !example || !example.includes(target)) return example;
  const parts = example.split(target);
  return (
    <>
      {parts[0]}
      {parts.slice(1).map((p, i) => (
        <span key={i}>
          <strong className="font-bold">{target}</strong>
          {p}
        </span>
      ))}
    </>
  );
}

export function ReviewSession({
  initialItems,
}: {
  initialItems: ReviewItem[];
}) {
  // --- All hooks at top, stable order across renders ---
  // (rules-of-hooks: never put a hook after a conditional return.)
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"QUIZ" | "ANSWER_REVEALED">("QUIZ");
  const [autoplay, setAutoplay] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Per Frank #6175: session timer for the review bucket. Active=true
  // for the whole session (no easy UX signal to derive "active" from in
  // pure-recall flow — there's no recording, no playback state tied to
  // a single action, the user is actively recalling throughout).
  const { elapsed: reviewElapsed } = useSessionTimer("review");

  const done = index >= initialItems.length;
  const current = done ? null : initialItems[index];

  // Hydrate autoplay pref from localStorage on mount.
  useEffect(() => {
    setAutoplay(loadAutoplayPref());
    setHydrated(true);
  }, []);

  // Persist autoplay changes (skip the initial render before hydration
  // so we don't overwrite the stored value with the default `true`).
  useEffect(() => {
    if (hydrated) saveAutoplayPref(autoplay);
  }, [autoplay, hydrated]);

  // Reset to QUIZ on new question entry.
  useEffect(() => {
    setPhase("QUIZ");
  }, [index]);

  // Auto-play TTS on entering QUIZ (§6). Small delay so React commits
  // the new sentence render before the speech request lands — avoids
  // the cancel from the cleanup timer racing with the new speak().
  useEffect(() => {
    if (!hydrated || phase !== "QUIZ" || !autoplay) return;
    const text = current?.example_sentence;
    if (!text) return;
    const t = setTimeout(() => speakJa(text), 150);
    return () => clearTimeout(t);
  }, [index, phase, autoplay, hydrated, current?.example_sentence]);

  const handleReveal = useCallback(() => {
    setPhase("ANSWER_REVEALED");
    // §9: replay full sentence audio after reveal (helps user
    // confirm what they missed or got right).
    if (current?.example_sentence) speakJa(current.example_sentence);
  }, [current]);

  const handleOutcome = useCallback(
    async (outcome: "remembered" | "again") => {
      if (!current) return;
      const fd = new FormData();
      fd.set("review_id", current.id);
      fd.set("outcome", outcome);
      await recordReviewAction(fd);
      setIndex((i) => i + 1);
    },
    [current]
  );

  // --- Now safe to early-return ---
  if (done) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">🎉</div>
        <p className="text-lg font-medium">复习完成！</p>
        <p className="text-sm text-gray-500 mt-2">
          共复习 {initialItems.length} 个单词。
        </p>
        <Link
          href="/today"
          className="inline-block mt-6 px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
        >
          回到今日
        </Link>
      </div>
    );
  }

  if (!current) return null;

  const hasExample = !!current.example_sentence;
  // Non-null assertion: hasExample === true implies current.example_sentence
  // is truthy, but TS doesn't narrow object properties through a boolean
  // local. The `!` makes it explicit + matches the runtime invariant.
  const blanked = hasExample
    ? blankTarget(current.example_sentence!, current.word)
    : null;

  return (
    <div className="space-y-8">
      {/* Progress + autoplay toggle (top, §16) */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div>复习 · {index + 1} / {initialItems.length}</div>
        {hydrated && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => setAutoplay(e.target.checked)}
              className="w-4 h-4 accent-gray-900"
              aria-label="自动播放音频"
            />
            <span>自动播放音频</span>
          </label>
        )}
      </div>

      {/* Session timer (top, §16) */}
      <div className="text-xs text-gray-400 tabular-nums">
        🕐 {formatDuration(reviewElapsed)}
      </div>

      {/* Japanese sentence — biggest, text-left, leading-loose (§7).
         QUIZ: target blanked. ANSWER_REVEALED: target bolded. */}
      <div className="text-2xl font-medium text-gray-900 leading-loose text-left break-words whitespace-pre-wrap">
        {phase === "QUIZ" ? (
          blanked ?? <span className="italic text-gray-400">(例句缺失)</span>
        ) : hasExample && current.example_sentence ? (
          renderWithBoldTarget(current.example_sentence, current.word)
        ) : (
          <span className="italic text-gray-400">(例句缺失)</span>
        )}
      </div>

      {/* Reading + 🔊 inline (medium, §7 + §16). The 🔊 is on the same
         row as the reading, right-aligned — matches the doc sketch. */}
      <div className="flex items-start gap-3">
        <div className="flex-1 text-base text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
          {current.example_reading ?? (
            <span className="italic text-gray-400">(读音缺失)</span>
          )}
        </div>
        {hasExample && (
          <button
            type="button"
            onClick={() => {
              if (current.example_sentence) speakJa(current.example_sentence);
            }}
            className="flex-shrink-0 w-10 h-10 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center text-base"
            title={phase === "QUIZ" ? "播放整句" : "重播整句"}
            aria-label={phase === "QUIZ" ? "播放整句" : "重播整句"}
          >
            🔊
          </button>
        )}
      </div>

      {/* Chinese translation — always visible (§4, no toggle). */}
      <div className="text-base text-gray-600 leading-relaxed">
        {current.example_translation ?? (
          <span className="italic text-gray-400">(翻译缺失)</span>
        )}
      </div>

      {/* Bottom action — phase-specific (§7 + §16).
         QUIZ: center-aligned [显示单词] button.
         ANSWER_REVEALED: two full-width buttons [再来一次] [记住了]. */}
      <div className="pt-4">
        {phase === "QUIZ" ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleReveal}
              className="px-8 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors text-base font-medium"
            >
              显示单词
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleOutcome("again")}
              className="flex-1 px-6 py-4 rounded-xl border-2 border-red-300 text-red-700 hover:bg-red-50 transition-colors text-base font-medium"
            >
              再来一次
            </button>
            <button
              type="button"
              onClick={() => handleOutcome("remembered")}
              className="flex-1 px-6 py-4 rounded-xl border-2 border-green-300 text-green-700 hover:bg-green-50 transition-colors text-base font-medium"
            >
              记住了
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
