"use client";

// /review — single recall flow (per docs/review.docx).
//
// Frank #6663 redesign replaces the old fill-in (4 multiple-choice) +
// dictation (TTS-only) two-mode UI with one state machine:
//
//   QUIZ            → target blanked (input field per Frank #6668),
//                     reading HIDDEN (Frank #6668 — overrides doc §3),
//                     Chinese + 🔊, [显示单词]
//   ANSWER_REVEALED → full sentence (target bolded) + reading + Chinese +
//                     🔊, [再来一次] [记住了]
//
// Key design points from the doc:
//   §3 — reading HIDDEN in QUIZ, revealed in ANSWER_REVEALED (Frank #6668)
//   §4 — Chinese translation always visible (no toggle button)
//   §6 — auto-play TTS on new question entry (toggleable inline)
//   §7 + §16 — large Japanese + medium reading/Chinese + lots of
//              whitespace, minimal chrome, no complex cards
//   §8 — target word font-weight: 700 in ANSWER_REVEALED
//   §10 — bottom buttons [再来一次] (rating=again) / [记住了]
//          (rating=remembered)
//   §11 — reading always complete in ANSWER_REVEALED. Frank #6668
//          removed QUIZ-phase reading because user can read along
//          instead of actively listening + inferring the word.
//   §12 — different blank strategies for 单词/动词/形容词/固定搭配/词组
//
// Frank #6668 iteration (after testing deployed #6667):
//   - Reading hidden in QUIZ phase (overrides doc §3 + §11)
//   - Blank is now an <input> field, not static ＿＿＿＿
//   - Empty input OK; clicking 显示单词 reveals regardless
//
// SRS rating simplified from easy/medium/hard → remembered/again
// (SM-2 quality 5 / 2). See lib/vocabulary/reviews.ts recordReview().

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { ReviewItem } from "@/lib/vocabulary/reviews";
import { recordReviewAction } from "./actions";
import { useSessionTimer, formatDuration } from "@/lib/today-stats";

const AUTOPLAY_KEY = "japanese:review-autoplay";

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
 * Locate the [start, end) range in `example` that should be hidden /
 * highlighted to represent the target word. Returns null if no
 * reasonable position can be found — caller renders the example
 * unchanged.
 *
 * Strategy (Frank #6707 — review showed full sentence for conjugated
 * targets like 叩く in 彼はドアを叩いた。 because the old code only
 * did exact `example.includes(target)` substring search):
 *   1. Exact match — covers nouns, dictionary-form appearances, and
 *      katakana/loan words.
 *   2. Kanji-prefix match with trailing-hiragana extension — covers
 *      verb/adj conjugations. Japanese verbs/adjectives keep their
 *      kanji root at the same position when conjugated; everything
 *      after the kanji until the next non-hiragana char is part of
 *      the inflection.
 *        叩く   → 叩いた / 叩いて / 叩かない / 叩ける / 叩けば
 *        食べる → 食べた / 食べます / 食べない
 *        飲む   → 飲んだ / 飲みます / 飲める / 飲もう
 *        早い   → 早かった / 早くない
 *        静か   → 静かな / 静かに
 *   3. Longest-prefix match with trailing-hiragana extension — for
 *      pure-hiragana targets (i-adjectives like おいしい→おいしく
 *      なかった, humble verbs). Min prefix length 2 to avoid noise
 *      from single-char particles.
 *   4. Return null → caller renders example unchanged.
 */
type BlankRange = { start: number; end: number };

function findBlankRange(
  example: string,
  target: string
): BlankRange | null {
  if (!example || !target) return null;

  // 1. Exact match.
  const exact = example.indexOf(target);
  if (exact !== -1) {
    return { start: exact, end: exact + target.length };
  }

  // 2. Kanji-prefix match. Leading run that's NOT hiragana/katakana
  //    catches kanji + ASCII + symbols + half-width.
  const kanjiPrefix = target.match(/^[^ぁ-ゟァ-ヿ]+/);
  if (kanjiPrefix) {
    const kanji = kanjiPrefix[0];
    const idx = example.indexOf(kanji);
    if (idx !== -1) {
      let end = idx + kanji.length;
      while (end < example.length && /[ぁ-ゟ]/.test(example[end])) {
        end++;
      }
      return { start: idx, end };
    }
  }

  // 3. Longest-prefix match for pure-hiragana targets (step 2 returned
  //    nothing because target has no non-kana prefix).
  for (let len = target.length - 1; len >= 2; len--) {
    const prefix = target.slice(0, len);
    const idx = example.indexOf(prefix);
    if (idx !== -1) {
      let end = idx + prefix.length;
      while (end < example.length && /[ぁ-ゟ]/.test(example[end])) {
        end++;
      }
      return { start: idx, end };
    }
  }

  return null;
}

/**
 * Frank #6742: replaced the old <input> field (Frank #6668) with a
 * non-interactive horizontal line — the user does NOT type a guess.
 * Pure passive recall: read the sentence, mentally fill in the
 * blank, then click 显示答案 to reveal.
 *
 * Frank #6668 (input field for typing guesses) was the prior UX;
 * Frank #6742 reverted to no-input since typing didn't add value
 * to recall practice.
 *
 * Uses `findBlankRange` so conjugated forms (叩く → 叩いた) also get
 * a blank — exact substring match alone missed them (Frank #6707).
 *
 * If no reasonable blank position can be determined, returns the
 * example unchanged — no blank rendered (signals inconsistent vocab
 * data; user reads the full sentence with no blank to fill in).
 *
 * Width: w-32 = 128px, fits most Japanese words; the sentence's
 * flex-1 wrapper handles overflow.
 */
function renderSentenceWithInput(
  example: string,
  target: string
): React.ReactNode {
  const range = findBlankRange(example, target);
  if (!range) return example;
  return (
    <>
      {example.slice(0, range.start)}
      {/* Frank #6742: replaced the prior <input> with a non-interactive
          horizontal line. Same w-32 width as the old input so the
          surrounding sentence doesn't reflow. align-baseline keeps
          the underline aligned with the surrounding Japanese
          text. No typing — just a visual placeholder for the blank. */}
      <span
        aria-label="目标词横线"
        className="inline-block w-32 mx-1 border-b-2 border-gray-900 align-baseline"
      />
      {example.slice(range.end)}
    </>
  );
}

/**
 * Render sentence with target word bolded (font-weight: 700, §8).
 * Used in ANSWER_REVEALED phase. Bolds the actual surface form in the
 * example (via `findBlankRange`) so conjugated targets (叩く → 叩いた)
 * still highlight the word the user was supposed to recall (Frank #6707).
 *
 * If no reasonable position can be determined, renders the full
 * sentence plain (no bolding).
 */
function renderWithBoldTarget(
  example: string,
  target: string
): React.ReactNode {
  const range = findBlankRange(example, target);
  if (!range) return example;
  const surface = example.slice(range.start, range.end);
  return (
    <>
      {example.slice(0, range.start)}
      <strong className="font-bold">{surface}</strong>
      {example.slice(range.end)}
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
  // Frank #6742: userAnswer / inputRef removed. Frank wants pure
  // passive recall — the user reads the sentence with the blank
  // line and clicks 显示答案 to reveal. No typing. See
  // renderSentenceWithInput doc comment for the rationale.
  // Frank #6710: rating buttons ("再来一次" / "记住了") were advancing
  // the question by +2 instead of +1. Root cause: handleOutcome is async
  // (awaits recordReviewAction → 100-500ms network round-trip) and the
  // buttons had no visual feedback during the await. Users (especially
  // touch / IME / impatient) often re-clicked before the first await
  // resolved, so handleOutcome fired twice and setIndex(i+1) ran twice.
  // Fix: in-flight flag that (a) early-returns on re-entry, (b) drives
  // `disabled` on both buttons so the second click is a no-op visually.
  const [outcomeInFlight, setOutcomeInFlight] = useState(false);

  // Frank #6717/#6722: freeze initialItems at mount via useState
  // (NOT useRef — Next.js `react-hooks/refs` ESLint rule forbids
  // reading `.current` during render). useState without a setter
  // only runs the initializer on first render, so `items` stays as
  // the initialItems from mount time even if the parent re-renders
  // with new initialItems props (e.g. revalidatePath in
  // recordReviewAction re-queries today's due reviews and drops the
  // just-reviewed word from the list — without this freeze, index=1
  // would point to a different word than the user expected, looking
  // like a +2 skip).
  const [items] = useState(initialItems);

  // Derived state must be declared BEFORE any hook that reads it —
  // rules-of-hooks + TS2448 ("used before declaration"). The session
  // timer below needs `current?.id` as segmentKey, so we compute
  // done/current first.
  const done = index >= items.length;
  const current = done ? null : items[index];

  // Per Frank #6175: session timer for the vocab bucket (vocab + review
  // pages both feed into this bucket per UI优化.docx — "词汇" item covers
  // /vocabulary/[id] + /review time). Active=true for the whole session.
  //
  // Per Frank #6696: 都改为跨词累加 (回退 from #6690/#6692 per-item
  // to cross-item cumulative). The display never resets on question
  // switch — it keeps showing the running total until the per-question
  // cap is reached. The elapsed value you see is the session's
  // cumulative total across all visited questions.
  //
  // Behavior:
  //   - maxMsPerSegment = 10000 → each question VISIT can
  //     contribute up to 10s. When a question hits 10s, the timer
  //     pauses.
  //   - When the user navigates to a new question, the segment
  //     resets (fresh 10s budget for the new question) but the
  //     total accumulatedMsRef carries over.
  //
  // Example: Q1 8s → switch to Q2 → display 8s (carried), Q2 fresh
  // 10s budget. Q2 runs 5s → display 13s. Q2 runs another 5s →
  // display 18s, Q2 cap reached, pause. Switch to Q3 → display 18s,
  // Q3 fresh 10s budget.
  //
  // Note: this contradicts docs/计时规则.docx §关键澄清 ("新词是
  // 独立的累加计数器") — Frank #6696 explicitly asked for
  // cross-item, so that's what ships. If he reverts, swap back to
  // per-item (see #6690/#6692 commit 45cf6bd).
  //
  // /listening / /speaking / /shadowing don't pass `segmentKey` so
  // they keep their old behavior (accumulate from mount to unmount,
  // no per-item logic) per Frank #6692.
  const { elapsed: reviewElapsed } = useSessionTimer("vocab", true, {
    maxMsPerSegment: 10000,
    segmentKey: current?.id,
  });

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

  // Reset to QUIZ on new question entry. Frank #6742 removed the
  // userAnswer reset + inputRef focus (no more input to focus).
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
    // Frank #6742: setUserAnswer("") removed (no input anymore).
    // §9: replay full sentence audio after reveal (helps user
    // confirm what they missed or got right).
    if (current?.example_sentence) speakJa(current.example_sentence);
  }, [current]);

  const handleOutcome = useCallback(
    async (outcome: "remembered" | "again") => {
      // Frank #6710: in-flight guard. The re-entry guard prevents the
      // second click from firing a duplicate server action + duplicate
      // setIndex. The `disabled` on the buttons is the user-facing
      // half — this is the programmatic half.
      if (!current || outcomeInFlight) return;
      setOutcomeInFlight(true);
      try {
        const fd = new FormData();
        fd.set("review_id", current.id);
        fd.set("outcome", outcome);
        await recordReviewAction(fd);
        setIndex((i) => i + 1);
      } finally {
        // Always clear the flag — even if recordReviewAction throws —
        // so the user isn't permanently locked out of grading.
        setOutcomeInFlight(false);
      }
    },
    [current, outcomeInFlight]
  );

  // Frank #6680: prev/next navigation. Clamped at [0, length-1] so
  // the buttons disable cleanly at boundaries (no wrap-around). These
  // change `index` only — they do NOT call recordReviewAction, so
  // skipping a question with 「下一题」 keeps it due for next
  // session. The primary way to grade is still 再来一次 / 记住了.
  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setIndex((i) => Math.min(items.length - 1, i + 1));
  }, [items.length]);

  // --- Now safe to early-return ---
  if (done) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">🎉</div>
        <p className="text-lg font-medium">复习完成！</p>
        <p className="text-sm text-gray-500 mt-2">
          共复习 {items.length} 个单词。
        </p>
        {/* Frank #6671 (UI优化.docx) removed /today route. Send the
            user back to /vocabulary to add more words or pick a
            different study mode. */}
        <Link
          href="/vocabulary"
          className="inline-block mt-6 px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
        >
          返回词汇
        </Link>
      </div>
    );
  }

  if (!current) return null;

  const hasExample = !!current.example_sentence;

  return (
    <div className="space-y-8">
      {/* Frank #6734: heading + session timer on the SAME row,
          timer right-justified. Heading was in page.tsx (the parent
          Server Component) — moved into this Client Component so it
          can share the flex row with the timer. The static header in
          page.tsx was removed; empty states (no items / no examples /
          no review queue) intentionally have no heading since their
          own titles (🎉📝🔄) speak for themselves. */}
      <header>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-bold">🔁 今日复习</h1>
          <div className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
            🕐 {formatDuration(reviewElapsed)}
          </div>
        </div>
        {/* Description moved from page.tsx so it only renders during
            active review (was above the empty-state branch). */}
        <p className="text-gray-600 mt-2">
          看到日语句子（目标词隐藏） + 完整读音 + 中文，主动回忆目标日语文字。
          点「显示单词」检查，记住了就下次再来，没记住马上复习。
        </p>
      </header>

      {/* Progress + autoplay toggle (top, §16) */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div>复习 · {index + 1} / {items.length}</div>
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

      {phase === "QUIZ" ? (
        <>
          {/* Frank #6668: QUIZ — sentence with inline input for active
             recall, no reading shown yet. The 🔊 is the only audio cue
             in QUIZ since reading is hidden. */}
          {hasExample && current.example_sentence ? (
            <div className="flex items-start gap-3">
              <div className="flex-1 text-2xl font-medium text-gray-900 leading-loose text-left break-words whitespace-pre-wrap">
                {/* Frank #6742: inputProps removed — no more typing.
                    User just reads the sentence with the horizontal
                    line and clicks 显示答案. */}
                {renderSentenceWithInput(
                  current.example_sentence,
                  current.word
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (current.example_sentence)
                    speakJa(current.example_sentence);
                }}
                className="flex-shrink-0 w-10 h-10 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center text-base"
                title="播放整句"
                aria-label="播放整句"
              >
                🔊
              </button>
            </div>
          ) : (
            <div className="text-2xl font-medium text-gray-900 leading-loose text-left break-words whitespace-pre-wrap">
              <span className="italic text-gray-400">(例句缺失)</span>
            </div>
          )}

          {/* Frank #6668: reading HIDDEN in QUIZ — only revealed alongside
             the answer in ANSWER_REVEALED. Doc §3 said show reading, but
             Frank #6668 testing revealed visible reading defeats the
             active-recall UX (user can read along instead of listening
             + inferring the word from audio + Chinese context). */}

          {/* Chinese translation — always visible (§4). */}
          <div className="text-base text-gray-600 leading-relaxed">
            {current.example_translation ?? (
              <span className="italic text-gray-400">(翻译缺失)</span>
            )}
          </div>

          {/* Frank #6668: empty input is OK — clicking 显示单词
             reveals the answer regardless of whether the user typed
             anything. The input is purely for active-recall practice,
             not for grading. */}
          <div className="pt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrev}
              disabled={index === 0}
              className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100 active:translate-y-px disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-medium"
              aria-label="上一题"
            >
              ← 上一题
            </button>
            <button
              type="button"
              onClick={handleReveal}
              className="px-8 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-700 active:translate-y-px transition-all text-base font-medium"
            >
              {/* Frank #6742: renamed 显示单词 → 显示答案 to match the
                  no-input UX (you're revealing the answer, not "the word"). */}
              显示答案
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={index === items.length - 1}
              className="px-4 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100 active:translate-y-px disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm font-medium"
              aria-label="下一题"
            >
              下一题 →
            </button>
          </div>
        </>
      ) : (
        <>
          {/* ANSWER_REVEALED: sentence with bold target (§8). */}
          <div className="text-2xl font-medium text-gray-900 leading-loose text-left break-words whitespace-pre-wrap">
            {hasExample ? (
              renderWithBoldTarget(current.example_sentence!, current.word)
            ) : (
              <span className="italic text-gray-400">(例句缺失)</span>
            )}
          </div>

          {/* Reading + 🔊 — revealed alongside the answer (Frank #6668).
             Reading was hidden in QUIZ per Frank's feedback that visible
             reading defeats the active-recall UX; now shown in
             ANSWER_REVEALED as part of the answer reveal. */}
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
                  if (current.example_sentence)
                    speakJa(current.example_sentence);
                }}
                className="flex-shrink-0 w-10 h-10 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center text-base"
                title="重播整句"
                aria-label="重播整句"
              >
                🔊
              </button>
            )}
          </div>

          {/* Chinese translation — always visible (§4). */}
          <div className="text-base text-gray-600 leading-relaxed">
            {current.example_translation ?? (
              <span className="italic text-gray-400">(翻译缺失)</span>
            )}
          </div>

          {/* 再来一次 / 记住了 (§10). Frank #6680 added prev/next above
             so the rating buttons stay primary (full-width, big touch
             target) and prev/next are a secondary nav row above. */}
          <div className="flex items-center justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={goPrev}
              disabled={index === 0}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100 active:translate-y-px disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
              aria-label="上一题"
            >
              ← 上一题
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={index === items.length - 1}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100 active:translate-y-px disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
              aria-label="下一题"
            >
              下一题 →
            </button>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleOutcome("again")}
              disabled={outcomeInFlight}
              className="flex-1 px-6 py-4 rounded-xl border-2 border-red-300 text-red-700 hover:bg-red-50 active:bg-red-100 active:translate-y-px transition-all text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              再来一次
            </button>
            <button
              type="button"
              onClick={() => handleOutcome("remembered")}
              disabled={outcomeInFlight}
              className="flex-1 px-6 py-4 rounded-xl border-2 border-green-300 text-green-700 hover:bg-green-50 active:bg-green-100 active:translate-y-px transition-all text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              记住了
            </button>
          </div>
        </>
      )}
    </div>
  );
}