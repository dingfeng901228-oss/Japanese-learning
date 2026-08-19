"use client";

// Week stats — spec §14. Renders the two real-time stats (本周学习 /
// 学习天数) by reading localStorage accumulated minutes via the
// useWeekStats() hook. The other two stats in the grid (新增单词 /
// 完成复习) come from Supabase via the parent server component.

import { useWeekStats } from "@/lib/today-stats";

function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function WeekStats() {
  const stats = useWeekStats();
  return (
    <>
      <div>
        <p className="text-xs text-gray-500 mb-1">本周学习</p>
        <p className="text-lg font-bold tabular-nums text-ink">
          {formatHM(stats.minutes)}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">学习天数</p>
        <p className="text-lg font-bold tabular-nums text-ink">
          {stats.daysStudied} / 7
        </p>
      </div>
    </>
  );
}
