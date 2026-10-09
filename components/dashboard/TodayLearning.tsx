"use client";

// Today's Learning — 听力/口语/词汇 三大训练目标 + 总进度 (per UI优化.docx).
//
// Per Frank #6671 (UI优化.docx):
//   - Drop the "Today's 3 tasks" sub-section — the explicit checklist
//     belonged to the retired /today page; the home dashboard now just
//     shows the 3 daily targets with progress minutes.
//   - Drop the 4-item inline progress list (听力 / 口语 / 真人发音 / 复习).
//   - Keep the big "今日の学習" header + total % bar.
//   - Show the new 3-item list (听力 / 口语 / 词汇) — loop iterates the
//     updated TRAINING_ITEMS in lib/today-stats.ts (listening / speaking
//     / vocab), so this component auto-follows any future item changes.
//
// Audit 2026-10-09 P1-4 (reversal of #6671 CTA removal): the dashboard
// showed progress but never said "what next" — every visit ended with
// the user staring at the TopNav wondering which module to open. Now
// we surface the first incomplete item as a primary CTA on the right
// of the header. When all 3 items are done the CTA is replaced by a
// muted "今日已完成 ✓" — same visual weight, no nag.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  TRAINING_ITEMS,
  TOTAL_TARGET_MINUTES,
  loadDayProgress,
  loadAccumulated,
  type DayProgress,
  type DayAccumulated,
  type TrainingItemId,
} from "@/lib/today-stats";

export function TodayLearning() {
  const [progress, setProgress] = useState<DayProgress | null>(null);
  const [accumulated, setAccumulated] = useState<DayAccumulated | null>(null);

  useEffect(() => {
    setProgress(loadDayProgress());
    setAccumulated(loadAccumulated());
  }, []);

  const totalMinutes = accumulated
    ? TRAINING_ITEMS.reduce(
        (s, i) => s + (accumulated.accumulated[i.id] ?? 0),
        0
      )
    : 0;
  const percent = Math.min(
    100,
    Math.round((totalMinutes / TOTAL_TARGET_MINUTES) * 100)
  );
  const isCompleted = percent >= 100;

  // P1-4: pick the first TRAINING_ITEM that's not done yet. Used as
  // the "what next" CTA in the section header. Null when everything
  // is done (then we render the muted "completed" badge instead).
  const nextUp = TRAINING_ITEMS.find(
    (item) => !isItemDone(item.id as TrainingItemId)
  );

  function isItemDone(id: TrainingItemId): boolean {
    const item = TRAINING_ITEMS.find((i) => i.id === id);
    if (!item) return false;
    const manualDone = !!progress?.completed[id];
    const autoDone = (accumulated?.accumulated[id] ?? 0) >= item.minutes;
    return manualDone || autoDone;
  }

  return (
    <section className="bg-white border border-line rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="font-jp text-xl font-bold text-ink">今日の学習</h2>
          <p className="text-xs text-gray-500 mt-0.5">今日完成度</p>
        </div>
        {/* P1-4: primary CTA = jump to the first incomplete module.
            When all done, swap to a quiet success state instead. */}
        {nextUp ? (
          <Link
            href={nextUp.href}
            className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-ink text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            {nextUp.emoji} 开始 {nextUp.label} →
          </Link>
        ) : (
          <span
            className="inline-flex items-center h-10 px-4 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium tabular-nums"
            aria-label="今日训练已完成"
          >
            ✓ 今日已完成
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <span className="text-4xl font-bold tabular-nums text-ink">
          {percent}%
        </span>
        <span className="text-xs text-gray-500 tabular-nums">
          {Math.round(totalMinutes)} / {TOTAL_TARGET_MINUTES} 分
        </span>
      </div>

      <div
        className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-6"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="今日完成度"
      >
        <div
          className={`h-full transition-all ${
            isCompleted ? "bg-success" : "bg-ink"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="space-y-2">
        {TRAINING_ITEMS.map((item) => {
          const minutes = Math.round(accumulated?.accumulated[item.id] ?? 0);
          const done = isItemDone(item.id);
          return (
            <li
              key={item.id}
              className="flex items-center justify-between text-sm"
            >
              <span className={done ? "text-gray-400" : "text-gray-700"}>
                {item.emoji} {item.label}
              </span>
              <span className="tabular-nums text-gray-500">
                {minutes} / {item.minutes} 分
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}