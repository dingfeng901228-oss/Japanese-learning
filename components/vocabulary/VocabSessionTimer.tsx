"use client";

// /vocabulary/[id] session timer — counts total time the user spends
// on the vocab page (cumulative across word switches).
//
// Per Frank #6683: 计时逻辑有问题，不是每次切换下一个都重新计时，
// 而应该是累加计时. So:
//   - NO segmentKey dep → useSessionTimer's accumulatedMs is NOT
//     reset when the user navigates to a different vocab item (prev /
//     next / "切换单词" grid / swipe). Timer keeps counting.
//   - NO maxMsPerSegment cap → under cumulative timing a per-item cap
//     is meaningless (5s total budget would be exhausted on the
//     first word, permanently pausing for the rest of the session).
//     The timer now runs continuously from mount to unmount.
//
// The "vocab" TrainingItemId is the same bucket /review uses (per
// UI优化.docx § 9: 词汇 = /vocabulary + /review time combined), so
// this timer contributes to the same daily_rollups bucket that the
// home dashboard's "词汇" item reads from.
//
// Backward compat: useSessionTimer still accepts segmentKey +
// maxMsPerSegment options — other callers (e.g. /listening) can still
// use them. We just don't use them here.

import { useSessionTimer, formatDuration } from "@/lib/today-stats";

export function VocabSessionTimer({ vocabId: _vocabId }: { vocabId: string }) {
  // Per Frank #6683: timer accumulates across word switches.
  // We intentionally do NOT pass segmentKey (would reset on switch)
  // or maxMsPerSegment (would permanently pause after first cap hit).
  const { elapsed, running } = useSessionTimer("vocab", true);

  // With no cap, running never becomes false; the (已暂停) hint
  // would never apply, so we drop it.
  void running;

  return (
    <span
      className="text-xs text-gray-500 tabular-nums"
      aria-label="本次学习时长"
      title="累加计时 — 切换单词不会重置"
    >
      🕐 {formatDuration(elapsed)}
    </span>
  );
}
