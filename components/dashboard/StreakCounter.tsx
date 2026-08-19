"use client";

// Streak counter — spec §13. Per Frank #6295: reads daily_rollups from
// Supabase (cross-device) instead of scanning localStorage. Falls back
// to 0/0/0 if the user hasn't trained yet (no rows in the table).

import { useMemo } from "react";
import { computeStreakFromDays } from "@/lib/today-stats";
import { useDailyRollups } from "@/lib/use-daily-rollups";

export function StreakCounter() {
  const { data: rollups } = useDailyRollups(365);

  const streak = useMemo(() => {
    const days = new Set(
      rollups.filter((r) => r.minutes > 0).map((r) => r.date)
    );
    return computeStreakFromDays(days);
  }, [rollups]);

  return (
    <div className="flex items-center gap-4">
      <span className="text-3xl" aria-hidden="true">
        🔥
      </span>
      <div>
        <p className="text-3xl font-bold tabular-nums text-ink">
          {streak.current}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">
          日连续学习 · 最长 {streak.longest} 天
        </p>
      </div>
    </div>
  );
}