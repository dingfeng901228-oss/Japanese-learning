"use client";

// /vocabulary/[id] session timer — counts time the user spends
// across the vocab detail page, CUMULATIVE across word switches,
// capped at 10s PER WORD VISIT.
//
// Per Frank #6696: 都改为跨词累加 (switch back from #6690/#6692
// per-item to cross-item cumulative). The display never resets on
// word switch — it keeps showing the running total until the per-word
// cap is reached. Same item viewed multiple times in a row will
// add up to the cap, then pause.
//
// Per Frank #6704: per-word cap changed from 5s → 10s (only the
// vocab side — /review stays at 10s/question).
//
// Note: this contradicts docs/计时规则.docx §关键澄清 ("新词是
// 独立的累加计数器") — Frank explicitly asked for cross-item in
// #6696, so that's what ships. If he reverts again, swap this
// back to per-item (see #6690/#6692 for the localStorage layer).
//
// Behavior:
//   - maxMsPerSegment = 10000 → each word VISIT can contribute up
//     to 10s to the running total. When a word hits 10s, the timer
//     pauses (running flips to false).
//   - When the user navigates to a different vocab item, the
//     segment resets (fresh 10s budget for the new word) but the
//     total accumulatedMsRef carries over — the display continues
//     from the old total + (now - new segmentStart).
//
// Example: word A 5s → switch to word B → display shows 5s (carried
// from A), word B's own time starts at 0. Word B runs another 5s →
// display shows 10s, word B's per-word cap reached, timer pauses.
// Switch to word C → display shows 10s (carried), word C fresh 10s
// budget. So the display can go up to 10 × n seconds (n = words
// visited), but each individual word contributes at most 10s.
//
// The "(已暂停)" hint is intentionally NOT shown (per Frank #6695 —
// the elapsed value alone is enough context when the timer is
// paused).
//
// The "vocab" TrainingItemId is the same bucket /review uses (per
// UI优化.docx § 9: 词汇 = /vocabulary + /review time combined), so
// this timer contributes to the same daily_rollups bucket that the
// home dashboard's "词汇" item reads from.

import { useSessionTimer, formatDuration } from "@/lib/today-stats";

export function VocabSessionTimer({ vocabId: _vocabId }: { vocabId: string }) {
  // Per Frank #6696: cross-item cumulative (回退 from #6690/#6692
  // per-item). The displayed elapsed is the running total across
  // word switches; only segmentStartRef resets on segmentKey
  // change, so the per-word 10s cap (per #6704) still applies to
  // each visit.
  const { elapsed } = useSessionTimer("vocab", true, {
    maxMsPerSegment: 10000,
    segmentKey: _vocabId,
  });

  return (
    <span
      className="text-xs text-gray-500 tabular-nums"
      aria-label="本次学习时长"
      title="跨词累加 — 切到下个词 display 继续走，每个词访问 10s 上限"
    >
      🕐 {formatDuration(elapsed)}
    </span>
  );
}
