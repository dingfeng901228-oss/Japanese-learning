"use client";

// /vocabulary/[id] session timer — counts time the user spends on a
// single vocab detail page, capped at 5s per word per Frank #6671
// (UI优化.docx § 12): "点开词汇详情页面时开始计时，单个词汇单次最多
// 计5秒的时间。 超过5秒计时暂停，直到翻下个词，再继续计时。"
//
// Implementation:
//   - segmentKey = vocabId → useSessionTimer resets accumulatedMs
//     when the user navigates to a different vocab item (Next.js
//     re-renders the same [id] route on different ids, so the
//     effect dep change fires automatically).
//   - maxMsPerSegment = 5000 → after 5s the cap freezes the segment
//     and running flips to false. UI shows "(已暂停)" until the user
//     navigates to the next word (segmentKey change → fresh 5s).
//   - The "vocab" TrainingItemId is the same bucket /review uses
//     (per UI优化.docx § 9: 词汇 = /vocabulary + /review time
//     combined), so this timer contributes to the same daily_rollups
//     bucket that the home dashboard's "词汇" item reads from.

import { useSessionTimer, formatDuration } from "@/lib/today-stats";

export function VocabSessionTimer({ vocabId }: { vocabId: string }) {
  const { elapsed, running } = useSessionTimer("vocab", true, {
    maxMsPerSegment: 5000,
    segmentKey: vocabId,
  });

  return (
    <span
      className="text-xs text-gray-500 tabular-nums"
      aria-label="本次学习时长"
      title={running ? "单次最多 5 秒" : "已暂停 — 翻下个词继续"}
    >
      🕐 {formatDuration(elapsed)}
      {!running && <span className="ml-1 text-gray-400">(已暂停)</span>}
    </span>
  );
}
