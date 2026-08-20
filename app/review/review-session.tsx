"use client";

// Fill-in + dictation review session (Phase 7 + Phase 8 lite).
//
// Mode "fill-in" (default):
//   - User sees the blanked example sentence + meaning/reading hint.
//   - Types the word back. Enter to check. 3 difficulty buttons.
//   - 🔊 button plays the original (unblanked) sentence.
//
// Mode "dictation":
//   - Blank sentence is HIDDEN until after the user answers (forces
//     listening instead of reading). Only the meaning hint is shown.
//   - TTS auto-plays the example sentence on each new item.
//   - "🔁 再听一次" replays it manually.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ReviewItem } from "@/lib/vocabulary/reviews";
import { recordReviewAction } from "./actions";
import { SpeakButton } from "@/components/SpeakButton";
import { useSessionTimer, formatDuration } from "@/lib/today-stats";

export type ReviewMode = "fill-in" | "dictation";

// Per Frank #6372: fill-in mode is now multiple-choice (4 options:
// 1 correct + 3 AI-generated distractors). Dictation mode stays text
// input (TTS-first, no point in showing options before user has listened).
export type DistractorsMap = Record<string, string[]>; // vocab_id → 3 distractors

function speakJa(text: string) {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "ja-JP";
  utt.rate = 0.9;
  window.speechSynthesis.speak(utt);
}

export function ReviewSession({
  initialItems,
  mode = "fill-in",
  distractors = {},
}: {
  initialItems: ReviewItem[];
  mode?: ReviewMode;
  distractors?: DistractorsMap;
}) {
  // --- All hooks at the top, in a stable order across renders ---
  // (rules-of-hooks: never put a hook after a conditional return.)
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<null | { correct: boolean }>(null);
  // Per Frank #6372: which option the user picked (index into options
  // array). null = not picked yet. Resets on item change.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Phase 1.5+ real-time session timer (per Frank #6175). Each
  // ReviewSession instance owns its own timer keyed to "review".
  const { elapsed: reviewElapsed } = useSessionTimer("review");

  const done = index >= initialItems.length;
  const current = done ? null : initialItems[index];

  // Auto-focus the answer input on each new item (ref + useEffect to
  // satisfy jsx-a11y/no-autofocus).
  useEffect(() => {
    inputRef.current?.focus();
  }, [index]);

  // Per Frank #6372: build the 4 options array for the current item.
  // Shuffled via Fisher-Yates once per item (useMemo on `index`).
  const options = useMemo(() => {
    if (!current) return [] as string[];
    const correct = current.word;
    const distractorList = distractors[current.vocabulary_id] ?? [];
    const pool = [correct, ...distractorList.slice(0, 3)];
    const seen = new Set<string>();
    const safe: string[] = [];
    for (const d of pool) {
      if (!d || seen.has(d)) continue;
      seen.add(d);
      safe.push(d);
      if (safe.length === 4) break;
    }
    while (safe.length < 4) safe.push(`(${correct} 干扰项)`);
    for (let i = safe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [safe[i], safe[j]] = [safe[j], safe[i]];
    }
    return safe;
  }, [current?.vocabulary_id, index, distractors]);

  // Reset selection when item advances.
  useEffect(() => {
    setSelectedIdx(null);
  }, [index]);

  // Dictation mode: auto-play TTS on each new item.
  useEffect(() => {
    if (mode !== "dictation") return;
    if (!current?.example_sentence) return;
    speakJa(current.example_sentence);
  }, [index, mode, current?.example_sentence]);

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

  // Blank out the word in the example sentence for fill-in. Limitation:
  // only blanks the literal word string. If the example inflects the
  // word ("本編を" when word is "本編"), it won't match — Phase 7+ would
  // need a token-aware blanker.
  // Per Frank #6372: fill-in mode no longer uses the blanked sentence
  // (it shows 4 options). Dictation mode still uses blanked for
  // post-answer reveal.
  const blanked = current.example_sentence
    ? current.example_sentence.split(current.word).join("_____")
    : "(例句缺失)";

  // Per Frank #6372: for fill-in mode, derive check correctness from
  // the picked option; for dictation, from typed answer.
  const isCorrectPick =
    selectedIdx !== null &&
    options[selectedIdx] !== undefined &&
    options[selectedIdx] === current.word;
  const checkedCorrect =
    mode === "fill-in"
      ? selectedIdx !== null
        ? isCorrectPick
        : null
      : checked;

  function handleCheck() {
    if (!answer.trim() || !current) return;
    const userAnswer = answer.trim();
    const correct = userAnswer === current.word;
    setChecked({ correct });
  }

  // Per Frank #6372: fill-in mode picks an option instead of typing.
  function handleOptionPick(idx: number) {
    if (selectedIdx !== null) return; // ignore re-pick after checked
    setSelectedIdx(idx);
  }

  async function handleNext(difficulty: "easy" | "medium" | "hard") {
    if (!current) return;
    if (checkedCorrect !== null) {
      const userAnswer =
        mode === "fill-in" && selectedIdx !== null
          ? options[selectedIdx] ?? ""
          : answer;
      const fd = new FormData();
      fd.set("review_id", current.id);
      fd.set("answer", userAnswer);
      fd.set("correct", checkedCorrect ? "1" : "0");
      fd.set("difficulty", difficulty);
      await recordReviewAction(fd);
    }
    setAnswer("");
    setChecked(null);
    setSelectedIdx(null);
    setIndex(index + 1);
  }

  // Per Frank #6390: prev/next question navigation. Doesn't record
  // SM-2 answer (user is just skipping around), just changes the index.
  function goPrev() {
    if (index > 0) setIndex(index - 1);
  }
  function goNext() {
    if (index < initialItems.length - 1) setIndex(index + 1);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={index === 0}
              className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← 上一题
            </button>
            <div className="text-xs text-gray-500">
              {mode === "dictation"
                ? "🎧 听写"
                : `第 ${index + 1} / ${initialItems.length} 题`}
            </div>
            <button
              type="button"
              onClick={goNext}
              disabled={index >= initialItems.length - 1}
              className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              下一题 →
            </button>
          </div>
          <div className="text-xs text-gray-400">
            间隔 {current.interval_days} 天 · 难度 {current.ease_factor.toFixed(2)}
          </div>
        </div>

        {/* Per Frank #6365: hint shows only the Chinese meaning.
            Kana reading was redundant — it doubled up with the
            Japanese word for kanji-vocab and added noise rather than
            information for learners who already read kana. */}
        <div className="text-xs text-gray-500 mb-1">提示</div>
        <div className="text-base text-gray-700 mb-4">
          {current.meaning}
        </div>

        {/* Fill-in mode: show the blanked example sentence + a 🔊 to
            hear the original. Dictation mode: show nothing here —
            the TTS auto-played above is the only source. */}
        {mode === "fill-in" && (
          <div className="border-t border-gray-100 pt-4 flex items-start gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500">
          第 {index + 1} / {initialItems.length} 题
        </div>
        <span
          aria-label="本次复习时长"
          className="text-xs text-gray-500 tabular-nums"
        >
          🕐 {formatDuration(reviewElapsed)}
        </span>
      </div>
              <p className="text-lg text-gray-900 whitespace-pre-wrap break-words">
                {blanked}
              </p>
            </div>
            <div className="flex-shrink-0 -mt-1">
              {current.example_sentence && (
                <SpeakButton text={current.example_sentence} />
              )}
            </div>
          </div>
        )}
        {mode === "dictation" && (
          <div className="border-t border-gray-100 pt-4 flex items-center gap-3">
            <div className="flex-1 text-sm text-gray-500">
              例句已自动播放。听完写下单词。
            </div>
            {current.example_sentence && (
              <button
                type="button"
                onClick={() => speakJa(current.example_sentence ?? "")}
                className="text-sm text-gray-700 hover:text-gray-900 underline-offset-2 hover:underline"
              >
                🔁 再听一次
              </button>
            )}
          </div>
        )}
      </div>

      {checkedCorrect !== null ? (
        <div
          className={`bg-white border-2 rounded-2xl p-6 ${
            checkedCorrect ? "border-green-500" : "border-red-500"
          }`}
        >
          <div className="text-lg font-bold mb-2">
            {checkedCorrect ? "✓ 正确" : "✗ 不对"}
          </div>
          {!checkedCorrect && (
            <p className="text-sm text-gray-600 mb-2">
              正确答案是：<strong>{current.word}</strong>
            </p>
          )}
          {/* In dictation mode, reveal the original sentence after the
              answer so the user can compare what they heard vs. what
              they wrote. */}
          {mode === "dictation" && current.example_sentence && (
            <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm">
              <div className="text-gray-900">{current.example_sentence}</div>
              {current.example_reading && (
                <div className="text-gray-500 mt-1">
                  {current.example_reading}
                </div>
              )}
              {current.example_translation && (
                <div className="text-gray-600 mt-1">
                  {current.example_translation}
                </div>
              )}
            </div>
          )}
          {mode === "fill-in" && current.example_translation && (
            <p className="text-sm text-gray-500 mb-4">
              {current.example_translation}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleNext("hard")}
              className="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
            >
              很难，再看一遍
            </button>
            <button
              type="button"
              onClick={() => handleNext("medium")}
              className="px-3 py-2 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100"
            >
              普通
            </button>
            <button
              type="button"
              onClick={() => handleNext("easy")}
              className="px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
            >
              简单
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          {mode === "fill-in" ? (
            // Per Frank #6372: fill-in mode now renders 4 multiple-choice
            // options instead of a text input. Dictation mode stays text
            // input (TTS-first; options would give it away).
            <>
              <div className="text-sm font-medium text-gray-700 mb-3">
                选择正确答案
              </div>
              <div className="grid grid-cols-1 gap-2">
                {options.map((opt, i) => (
                  <button
                    key={`${current.id}-${i}`}
                    type="button"
                    onClick={() => handleOptionPick(i)}
                    className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:border-gray-900 hover:bg-gray-50 transition-colors text-base"
                  >
                    <span className="inline-block w-6 text-gray-400 tabular-nums">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label
                htmlFor="answer"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                输入单词
              </label>
              <input
                ref={inputRef}
                id="answer"
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCheck();
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
                placeholder="..."
              />
              <button
                type="button"
                onClick={handleCheck}
                className="mt-4 px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                检查
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
