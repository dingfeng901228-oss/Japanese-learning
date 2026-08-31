"use client";

// LearnSession — client component for /vocabulary/learn.
//
// Per docs/vocabuly0831.md (Frank #7397, 2026-08-31):
//   - Each vocab mount calls startLearningSessionAction → server RPC
//     increments vocabulary_items.learning_count by 1 (idempotent via
//     session_token).
//   - /vocabulary/[id] does NOT touch learning_count.
//   - "[下一个]" advances to the next vocab in the server-provided
//     queue (no server roundtrip — full queue loaded once on the
//     server component).
//   - On the last vocab, the button morphs into "[完成今日学习 ✓]"
//     which calls setDailyLearningStatusAction("completed") and
//     navigates back to /vocabulary.
//
// Idempotency model (per §七):
//   - sessionStorage keyed by vocab_id. Same URL refresh in same tab
//     reuses the same token → no double-count.
//   - New tab / next day / after tab close → fresh token → legitimate
//     new session → +1.
//   - Server-side PK (user_id, session_token) on
//     vocab_learning_session_tokens is the final guard — even if
//     sessionStorage is wiped mid-session, a re-submitted same token
//     no-ops via ON CONFLICT.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { VocabularyItem } from "@/lib/vocabulary";
import type { LearningFilterContext } from "@/lib/vocabulary/learn";
import {
  startLearningSessionAction,
  setDailyLearningStatusAction,
} from "@/app/vocabulary/actions";
import { SpeakButton } from "@/components/SpeakButton";
// Note: startLearningSessionAction is intentionally still imported even
// though LearnSession no longer calls it directly. The detail page
// (app/vocabulary/[id]/LearningTracker.tsx) owns the +1 trigger per
// Frank #7458 (2026-08-31). Import remains in case we want to
// restore per-session counting in the future.

type Props = {
  queue: VocabularyItem[];
  startIndex: number;
  dailyStatus: "active" | "completed";
  filterContext: LearningFilterContext;
};

const TYPE_LABEL: Record<string, string> = {
  word: "单词",
  phrase: "词组",
  grammar: "文法",
  sentence: "句型",
};

// Stable key for the filter context — parent re-renders would pass a
// new object reference for filterContext every time, so without this
// key the session-start effect would re-fire on every render.
function filterKeyOf(fc: LearningFilterContext): string {
  return [
    fc.type ?? "",
    fc.level ?? "",
    fc.sort ?? "",
    fc.query ?? "",
  ].join("\u0001");
}

function getOrCreateSessionToken(vocabId: string): string {
  if (typeof window === "undefined") return "";
  const key = `vocab_learn_${vocabId}`;
  let token = sessionStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    try {
      sessionStorage.setItem(key, token);
    } catch {
      // sessionStorage quota / disabled — degrade gracefully. The
      // server-side PK (user_id, session_token) still catches truly
      // duplicate RPC calls within the same browser instance.
    }
  }
  return token;
}

export function LearnSession({
  queue,
  startIndex,
  dailyStatus,
  filterContext,
}: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(startIndex);
  const [isFinishing, setIsFinishing] = useState(false);

  const current = queue[index];
  const isLast = index >= queue.length - 1;

  // Per Frank #7458 (2026-08-31, docs/vocabuly0831.md follow-up):
  // "打开单词详情页即视为在学习" — the detail page IS the canonical
  // learning surface. LearnSession no longer increments learningCount
  // on mount; that trigger moved to app/vocabulary/[id]/LearningTracker.
  // This page is now a queue walker (next button moves you to the
  // next vocab's detail page, which DOES increment).
  //
  // The sessionStorage token pattern is removed because nothing here
  // calls start_learning_session anymore. Filter context is still
  // accepted as a prop for potential future use (e.g., logging which
  // filter the user was walking through), but currently unused.

  const finish = useCallback(async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await setDailyLearningStatusAction("completed");
    } catch (err) {
      console.error("LearnSession: markDaily failed", err);
    }
    router.push("/vocabulary");
  }, [isFinishing, router]);

  const handleNext = useCallback(() => {
    if (!isLast) {
      setIndex(index + 1);
    } else {
      // Last vocab reached — auto-mark today's learning as completed.
      // Per Frank #7397 §十五: "最后一个词 E 学习完成后：
      // 清除 lastLearningVocabularyId 或者将状态设置为 completed。"
      finish();
    }
  }, [index, isLast, finish]);

  if (!current) return null;

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/vocabulary"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 返回收藏列表
        </Link>
        <span className="text-xs text-gray-500 tabular-nums">
          {index + 1} / {queue.length}
        </span>
      </header>

      <article className="bg-white border border-gray-200 rounded-2xl p-8 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            {TYPE_LABEL[current.type] ?? current.type}
          </span>
          {current.level && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">
              {current.level}
            </span>
          )}
        </div>
        <div className="flex items-start gap-3 mb-2">
          <h1 className="flex-1 text-4xl font-bold break-words">
            {current.word}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SpeakButton text={current.word} />
          </div>
        </div>
        {current.reading && (
          <p className="text-lg text-gray-500 mb-4">{current.reading}</p>
        )}
        <p className="text-xl text-gray-800 mb-6">{current.meaning}</p>

        {/* 学习次数 display moved off this page — the detail page
            LearningTracker owns the count (per Frank #7458). Queue
            walker is now a pure navigation helper. */}
      </article>

      <button
        onClick={handleNext}
        disabled={isFinishing}
        className="w-full px-5 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-base font-medium disabled:bg-gray-400"
      >
        {isLast
          ? isFinishing
            ? "保存中..."
            : "完成今日学习 ✓"
          : "下一个 →"}
      </button>

      {/* Quiet hint that the daily status was already 'completed'
          when they entered — they can still walk through the queue
          (each vocab still counts as a learning session), but the
          "今日学习已完成 ✓" banner won't re-appear until tomorrow
          per Frank #7397 Q4. */}
      {dailyStatus === "completed" && (
        <p className="text-xs text-gray-500 text-center mt-3">
          提示：今日学习已完成 ✓（继续走完不影响统计）
        </p>
      )}
    </main>
  );
}