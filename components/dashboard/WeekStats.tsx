"use client";

// Week stats — spec §14. Per Frank #6295: pulls daily_rollups from
// Supabase (cross-device) instead of scanning localStorage. Two stats:
// total training minutes + days studied in the last 7 days.

import { useDailyRollups } from "@/lib/use-daily-rollups";

function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function WeekStats() {
  const { data: rollups } = useDailyRollups(7);

  let minutes = 0;
  let daysStudied = 0;
  for (const r of rollups) {
    if (r.minutes > 0) {
      minutes += r.minutes;
      daysStudied++;
    }
  }

  return (
    <>
      <div>
        <p className="text-xs text-gray-500 mb-1">本周学习</p>
        <p className="text-lg font-bold tabular-nums text-ink">
          {formatHM(minutes)}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">学习天数</p>
        {/* Frank #6750: removed " / 7" — Frank wants just the number.
            The "out of 7 days this week" denominator is implicit
            (the title says 本周 — this week = last 7 days). */}
        <p className="text-lg font-bold tabular-nums text-ink">
          {daysStudied}
        </p>
      </div>
    </>
  );
}