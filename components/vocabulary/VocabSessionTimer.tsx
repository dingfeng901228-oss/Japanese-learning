"use client";

// /vocabulary/[id] session timer — counts time the user spends
// across the vocab detail page, CUMULATIVE across word switches,
// capped at 5s PER WORD.
//
// Per Frank #6688: "词汇和复习模块计时逻辑有问题...而是应该
// 累加计时...单个词最多累加5秒（复习界面为10秒）" — so:
//   - Timer accumulates from mount to unmount, DOES NOT reset on
//     word switch. The display is the running total.
//   - maxMsPerSegment = 5000 → each word can contribute up to 5s
//     to the running total. When a word hits 5s, the timer pauses
//     (running flips to false, "(已暂停)" hint shows).
//   - When the user navigates to a different vocab item, the
//     segment resets (fresh 5s budget for the new word) but the
//     total accumulatedMsRef carries over — the display continues
//     from the old total + (now - new segmentStart).
//
// Example: word A 3s → switch to word B → display shows 3s (carried
// from A), word B's own time starts at 0. Word B runs another 2s →
// display shows 5s, word B's per-word cap reached, timer pauses.
// Switch to word C → display shows 5s (carried), word C fresh 5s
// budget. So the display can go up to 5 × n seconds (n = words
// visited), but each individual word contributes at most 5s.
//
// The "vocab" TrainingItemId is the same bucket /review uses (per
// UI优化.docx § 9: 词汇 = /vocabulary + /review time combined), so
// this timer contributes to the same daily_rollups bucket that the
// home dashboard's "词汇" item reads from.

import { useSessionTimer, formatDuration } from "@/lib/today-stats";

export function VocabSessionTimer({ vocabId }: { vocabId: string }) {
  // Per Frank #6688: cumulative timing + per-word cap restored.
  // useSessionTimer now:
  //   - keeps accumulatedMsRef across segmentKey changes (cumulative)
  //   - resets segmentStartRef on segmentKey change (per-word reset)
  //   - pauses when segMs (= now - segmentStart) hits maxMsPerSegment
  const { elapsed, running } = useSessionTimer("vocab", true, {
    maxMsPerSegment: 5000,
    segmentKey: vocabId,
  });

  return (
    <span
      className="text-xs text-gray-500 tabular-nums"
      aria-label="本次学习时长"
      title={running ? "累加计时 — 切换单词不重置，单词访问 5s 上限" : "已暂停 — 切到下个词继续（每个词最多 5s）"}
    >
      🕐 {formatDuration(elapsed)}
      {!running && <span className="ml-1 text-gray-400">(已暂停)</span>}
    </span>
  );
}
