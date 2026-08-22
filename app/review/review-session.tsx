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
 * Render the example sentence with an <input> field inserted where the
 * target word appears (Frank #6668). User types their guess into the
 * input; clicking 显示单词 reveals the answer regardless of whether
 * anything was typed (empty input is OK).
 *
 * If target isn't in the example, returns the example unchanged — no
 * input rendered (signals inconsistent vocab data; user can still read
 * the full sentence but has no blank to fill in).
 *
 * Styling: bottom-border underline to read as "blank line" at sentence
 * scale, bg-transparent so the surrounding text shows through. Width
 * fixed at ~8 chars (w-32 = 128px) which fits most Japanese words; the
 * sentence's flex-1 wrapper handles overflow.
 */
function renderSentenceWithInput(
  example: string,
  target: string,
  inputProps: {
    value: string;
    onChange: (v: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    inputRef: React.Ref<HTMLInputElement>;
  }
): React.ReactNode {
  if (!example.includes(target)) return example;
  const parts = example.split(target);
  return (
    <>
      {parts[0]}
      <input
        ref={inputProps.inputRef}
        type="text"
        value={inputProps.value}
        onChange={(e) => inputProps.onChange(e.target.value)}
        onKeyDown={inputProps.onKeyDown}
        placeholder="＿"
        aria-label="输入目标词"
        className="inline-block w-32 mx-1 border-b-2 border-gray-900 bg-transparent text-2xl font-medium text-center focus:outline-none focus:border-blue-500 px-1"
      />
      {parts.slice(1).map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </>
  );
}

/**
 * Render sentence with target word bolded (font-weight: 700, §8).
 * Used in ANSWER_REVEALED phase. If data is inconsistent and target
 * isn't in example, render the full sentence plain (no bolding).
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
  // Frank #6668: input field replaces the static ＿＿＿＿ blank in QUIZ
  // phase. User types their guess; empty answer is OK — clicking
  // 显示单词 still reveals the target.
  const [userAnswer, setUserAnswer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Derived state must be declared BEFORE any hook that reads it —
  // rules-of-hooks + TS2448 ("used before declaration"). The session
  // timer below needs `current?.id` as segmentKey, so we compute
  // done/current first.
  const done = index >= initialItems.length;
  const current = done ? null : initialItems[index];

  // Per Frank #6175: session timer for the vocab bucket (vocab + review
  // pages both feed into this bucket per UI优化.docx — "词汇" item covers
  // /vocabulary/[id] + /review time). Active=true for the whole session
  // (no easy UX signal to derive "active" from in pure-recall flow —
  // there's no recording, no playback state tied to a single action,
  // the user is actively recalling throughout).
  //
  // Per Frank #6671 (UI优化.docx § 13): 复习界面 10s/题 cap. segmentKey
  // = current?.id → when the user advances to the next question (index
  // increments, current changes), useSessionTimer resets the segment and
  // a fresh 10s budget starts. maxMsPerSegment=10000 → after 10s the
  // timer pauses until the next question. Together with the vocab page's
  // 5s/word cap (VocabSessionTimer.tsx), this enforces "看一个词最多
  // 5秒、答一道题最多 10秒" across the learning flow.
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

  // Reset to QUIZ on new question entry, clear typed answer, focus input.
  // Frank #6668: input is the new QUIZ affordance — needs to receive
  // focus automatically so user can type immediately.
  useEffect(() => {
    setPhase("QUIZ");
    setUserAnswer("");
    // requestAnimationFrame to wait for React to commit the new
    // QUIZ render (and the input element to mount) before focusing.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
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
    setUserAnswer(""); // clear typed guess (Frank #6668 — input is QUIZ-only)
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

      {phase === "QUIZ" ? (
        <>
          {/* Frank #6668: QUIZ — sentence with inline input for active
             recall, no reading shown yet. The 🔊 is the only audio cue
             in QUIZ since reading is hidden. */}
          {hasExample && current.example_sentence ? (
            <div className="flex items-start gap-3">
              <div className="flex-1 text-2xl font-medium text-gray-900 leading-loose text-left break-words whitespace-pre-wrap">
                {renderSentenceWithInput(
                  current.example_sentence,
                  current.word,
                  {
                    value: userAnswer,
                    onChange: setUserAnswer,
                    onKeyDown: (e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleReveal();
                      }
                    },
                    inputRef,
                  }
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
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={handleReveal}
              className="px-8 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors text-base font-medium"
            >
              显示单词
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

          {/* 再来一次 / 记住了 (§10). */}
          <div className="flex gap-3 pt-4">
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
        </>
      )}
    </div>
  );
}