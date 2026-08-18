"use client";

// Fill-in review session (Phase 8). One vocab at a time, the example
// sentence blanks out the target word, the user types it back. On Enter
// → check correctness locally (no API call) and surface 3 difficulty
// buttons that map to SM-2 quality scores (easy=5, medium=4, hard=3).
// Incorrect answers always use q=2.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ReviewItem } from "@/lib/vocabulary/reviews";
import { recordReviewAction } from "./actions";

export function ReviewSession({
  initialItems,
}: {
  initialItems: ReviewItem[];
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<null | { correct: boolean }>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the answer input on each new item. We use a ref instead
  // of the `autoFocus` attribute because the project's eslint config
  // (jsx-a11y/no-autofocus) disallows it — a ref + useEffect is the
  // accepted pattern.
  useEffect(() => {
    inputRef.current?.focus();
  }, [index]);

  if (index >= initialItems.length) {
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

  const current = initialItems[index];
  // Blank out the word in the example sentence for fill-in. We use
  // split/join instead of replaceAll for broader runtime support.
  // Limitation: only blanks the literal word string. If the example
  // inflects the word (e.g., "本編を" when word is "本編"), it won't
  // match — Phase 7+ would need a token-aware blanker.
  const blanked = current.example_sentence
    ? current.example_sentence.split(current.word).join("_____")
    : "(例句缺失)";

  function handleCheck() {
    if (!answer.trim()) return;
    const userAnswer = answer.trim();
    const correct = userAnswer === current.word;
    setChecked({ correct });
  }

  async function handleNext(difficulty: "easy" | "medium" | "hard") {
    // Only POST if the user actually checked an answer. (We shouldn't
    // reach here otherwise — the buttons are only rendered after check.)
    if (checked) {
      const fd = new FormData();
      fd.set("review_id", current.id);
      fd.set("answer", answer);
      fd.set("correct", checked.correct ? "1" : "0");
      fd.set("difficulty", difficulty);
      await recordReviewAction(fd);
    }
    setAnswer("");
    setChecked(null);
    setIndex(index + 1);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-gray-500">
            第 {index + 1} / {initialItems.length} 题
          </div>
          <div className="text-xs text-gray-400">
            间隔 {current.interval_days} 天 · 难度 {current.ease_factor.toFixed(2)}
          </div>
        </div>
        <div className="text-xs text-gray-500 mb-1">提示</div>
        <div className="text-base text-gray-700 mb-4">
          {current.reading && `${current.reading} · `}
          {current.meaning}
        </div>
        <div className="border-t border-gray-100 pt-4">
          <div className="text-xs text-gray-500 mb-2">例句（挖空）</div>
          <p className="text-lg text-gray-900 whitespace-pre-wrap break-words">
            {blanked}
          </p>
        </div>
      </div>

      {checked ? (
        <div
          className={`bg-white border-2 rounded-2xl p-6 ${
            checked.correct ? "border-green-500" : "border-red-500"
          }`}
        >
          <div className="text-lg font-bold mb-2">
            {checked.correct ? "✓ 正确" : "✗ 不对"}
          </div>
          {!checked.correct && (
            <p className="text-sm text-gray-600 mb-2">
              正确答案是：<strong>{current.word}</strong>
            </p>
          )}
          {current.example_translation && (
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
        </div>
      )}
    </div>
  );
}
