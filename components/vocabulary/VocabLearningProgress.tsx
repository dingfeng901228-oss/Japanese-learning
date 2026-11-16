"use client";

// VocabLearningProgress — replaces VocabSessionTimer on /vocabulary/[id].
//
// Shows per-vocab learning progress (X.Xs / 5.0s) with a progress bar
// and state label (学习中 / 已暂停 / 已学完).
//
// Per Frank #7274 / #7276 (2026-08-30) + docs/0830需求.md:
//   - 5s/word cap with daily reset baseline (was 10s cross-item
//     cumulative per old #6696 / #6704 VocabSessionTimer)
//   - State machine IDLE / VIEWING / PAUSED / COMPLETED
//   - Server-side enforcement via increment_vocab_learning_time
//     RPC (migration 0006)
//   - visibilitychange pause, pagehide sendBeacon — handled inside
//     the hook, no extra wiring here
//
// This component is presentational — all timing/state lives in
// useVocabLearningTimer so the same hook could be reused (e.g.,
// future dashboard widget) without duplication.

import { useEffect, useState } from "react";
import { useVocabLearningTimer } from "@/lib/use-vocab-learning-timer";
import { VOCAB_ACTIVE_ACTION_EVENT } from "./VocabActiveActions";

export function VocabLearningProgress({ vocabId }: { vocabId: string }) {
  // Audit 2026-11-16 P0-3: the 5s bar only starts once the user does
  // something deliberate with this word. Until then it reads 未开始.
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    function onAction(e: Event) {
      const detail = (e as CustomEvent<{ vocabId?: string }>).detail;
      if (detail?.vocabId === vocabId) setEngaged(true);
    }
    window.addEventListener(VOCAB_ACTIVE_ACTION_EVENT, onAction);
    return () =>
      window.removeEventListener(VOCAB_ACTIVE_ACTION_EVENT, onAction);
  }, [vocabId]);

  const { state, displayMs, progress } = useVocabLearningTimer(
    vocabId,
    engaged
  );

  const seconds = (displayMs / 1000).toFixed(1);

  const emoji =
    state === "COMPLETED" ? "✓" : state === "PAUSED" ? "⏸" : "📚";
  const label =
    state === "COMPLETED"
      ? "已学完"
      : state === "PAUSED"
        ? "已暂停"
        : state === "IDLE"
          ? "未开始"
          : "学习中";
  const textColor =
    state === "COMPLETED"
      ? "text-green-600"
      : state === "PAUSED"
        ? "text-gray-400"
        : state === "IDLE"
          ? "text-gray-400"
          : "text-blue-600";
  const barColor =
    state === "COMPLETED"
      ? "bg-green-500"
      : state === "PAUSED"
        ? "bg-gray-400"
        : state === "IDLE"
          ? "bg-gray-300"
          : "bg-blue-500";

  return (
    <div
      className="flex items-center gap-2 text-xs"
      aria-label={`单词学习进度 ${seconds} 秒 / 5.0 秒`}
      title={
        engaged
          ? "每个词每天最多 5 秒学习时间（按天重置）"
          : "点朗读或「标记已学」后开始计时"
      }
    >
      <span className={`tabular-nums whitespace-nowrap ${textColor}`}>
        {emoji} {label} {seconds}s / 5.0s
      </span>
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ease-out ${barColor}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
