"use client";

// Week stats — spec §14. Per Frank #6295: pulls daily_rollups from
// Supabase (cross-device) instead of scanning localStorage.
//
// Per Frank #7049 (2026-08-27): replaced the "学习天数 / N days" stat
// with "总共学习 / Xh Ym" (all-time total minutes). The day count was
// less meaningful than the cumulative study time. Fetch the wider
// window (365 days) so we can compute weekly + all-time from one
// query, then slice the tail for the 7-day window.
//
// Note: my earlier fix (commit 699f380) edited LearningActivityClient.tsx
// — the LINE CHART'S stats line — which was a different location from
// where Frank was looking. The 2×2 grid on the home page's right rail
// is rendered by THIS component. Two distinct stats areas; Frank
// flagged the one in WeekStats.

import { useDailyRollups } from "@/lib/use-daily-rollups";

function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

// Fetch 365 days so we have enough history for an "all-time" total.
// Bumping higher = longer WHERE date range but still tiny (bounded by
// the user's actual history — most users < 1 year of data).
const ROLLUP_WINDOW_DAYS = 365;

export function WeekStats() {
  const { data: rollups } = useDailyRollups(ROLLUP_WINDOW_DAYS);

  // Weekly window = last 7 days of the ascending-sorted rollups.
  // slice(-7) returns [] if rollups is empty → weeklyMinutes stays 0.
  const last7 = rollups.slice(-7);
  let weeklyMinutes = 0;
  for (const r of last7) {
    weeklyMinutes += r.minutes;
  }

  // All-time total = sum of the entire window we fetched.
  let totalMinutes = 0;
  for (const r of rollups) {
    totalMinutes += r.minutes;
  }

  return (
    <>
      <div>
        <p className="text-xs text-gray-500 mb-1">本周学习</p>
        <p className="text-lg font-bold tabular-nums text-ink">
          {formatHM(weeklyMinutes)}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">总共学习</p>
        <p className="text-lg font-bold tabular-nums text-ink">
          {formatHM(totalMinutes)}
        </p>
      </div>
    </>
  );
}