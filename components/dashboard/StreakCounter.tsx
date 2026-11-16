// Streak counter — spec §13.
//
// Audit 2026-11-16 P0-1: this used to be a client component that
// fetched daily_rollups through useDailyRollups(). That hook skips its
// fetch during the quiet hours (00:00-05:59) and then renders zeros, so
// the dashboard showed "最长连续 0 天" while the server-rendered
// PhaseBanner on the same page showed "最长连续 15 / 30 天".
//
// It is now presentational: the numbers arrive as props from the server
// (lib/vocabulary/stats.ts), so there is exactly one source and no
// hydration mismatch.

export function StreakCounter({
  current,
  longest,
}: {
  current: number;
  longest: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-3xl" aria-hidden="true">
        🔥
      </span>
      <div>
        <p className="text-3xl font-bold tabular-nums text-ink">{current}</p>
        <p className="text-sm text-gray-500 mt-0.5">
          日连续学习 · 最长 {longest} 天
        </p>
      </div>
    </div>
  );
}
