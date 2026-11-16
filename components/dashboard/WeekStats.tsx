// Week stats — spec §14.
//
// Audit 2026-11-16 P0-1: was a client component reading daily_rollups
// through useDailyRollups(), which skips the fetch during quiet hours
// (00:00-05:59) and renders zeros. Now presentational — the minutes
// come from the server (lib/vocabulary/stats.ts) so the home page, the
// activity chart and the streak all read the same rows.

import { formatHM } from "@/lib/vocabulary/stats";

export function WeekStats({
  weekMinutes,
  totalMinutes,
}: {
  weekMinutes: number;
  totalMinutes: number;
}) {
  return (
    <>
      <div>
        <p className="text-xs text-gray-500 mb-1">本周学习</p>
        <p className="text-lg font-bold tabular-nums text-ink">
          {formatHM(weekMinutes)}
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
