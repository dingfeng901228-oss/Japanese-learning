"use client";

// Today's Learning — spec §10, §11, §12.
// Reads today's accumulated training minutes from lib/today-stats.ts
// (date-keyed localStorage written by useSessionTimer on training
// pages) and renders the completion %, per-item progress, Today's 3
// Tasks, and the main CTA button.

import { useEffect, useState } from "react";
import Link from "next/link";
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

  // Per spec §12: 挑 3 个核心任务 (skip shadowing — it's a sub-mode of
  // listening, not a separate training mode).
  const tasks = TRAINING_ITEMS.filter((i) => i.id !== "shadowing");

  function isItemDone(id: TrainingItemId): boolean {
    const item = TRAINING_ITEMS.find((i) => i.id === id);
    if (!item) return false;
    const manualDone = !!progress?.completed[id];
    const autoDone = (accumulated?.accumulated[id] ?? 0) >= item.minutes;
    return manualDone || autoDone;
  }

  return (
    <section className="bg-white border border-line rounded-2xl p-6 md:p-8">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-jp text-xl font-bold text-ink">今日の学習</h2>
        <span className="text-xs text-gray-500">今日完成度</span>
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

      <ul className="space-y-2 mb-6">
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

      <div className="border-t border-line pt-5 mb-5">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
          今日の 3 つ
        </p>
        <ul className="space-y-1">
          {tasks.map((task) => {
            const done = isItemDone(task.id);
            return (
              <li key={task.id}>
                <Link
                  href={task.href}
                  className="flex items-center gap-3 py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0 ${
                      done
                        ? "bg-success border-success text-white"
                        : "border-gray-300"
                    }`}
                    aria-hidden="true"
                  >
                    {done && "✓"}
                  </span>
                  <span
                    className={
                      done ? "text-gray-400 line-through" : "text-gray-900"
                    }
                  >
                    {task.label}{" "}
                    <span className="text-gray-500">{task.minutes} 分钟</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <Link
        href="/today"
        className="block w-full text-center px-6 py-3 bg-ink text-white rounded-xl hover:bg-ink-700 transition-colors font-medium"
      >
        {isCompleted ? "今日学习已完成 ✓" : "开始今日学习 →"}
      </Link>
    </section>
  );
}
