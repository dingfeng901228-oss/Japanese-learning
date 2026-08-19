"use client";

// Streak counter — spec §13. Reads localStorage accumulated training
// minutes via useStreak() (in lib/today-stats.ts) and shows current +
// longest streak. Refreshes on focus + every 5s so the dashboard updates
// live as the user spends time in /listening / /speaking / /review.

import { useStreak } from "@/lib/today-stats";

export function StreakCounter() {
  const streak = useStreak();
  return (
    <div className="flex items-center gap-4">
      <span className="text-3xl" aria-hidden="true">🔥</span>
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
