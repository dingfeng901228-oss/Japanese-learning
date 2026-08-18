// UI 2.0 dashboard mock data sources.
// Per spec §13, §14, §16: real data is not yet available — use stable
// mock data that does NOT refresh on every render (so the dashboard
// looks consistent across reloads within the same day).

export type HeatmapDay = {
  date: string; // YYYY-MM-DD
  level: 0 | 1 | 2 | 3 | 4 | 5;
  minutes: number;
};

// Per spec §16: 固定 mock data, NOT randomly refreshing.
// Returns past 365 days ending today, with deterministic pseudo-random
// levels based on day-of-year (stable within a day).
export function buildHeatmapData(): HeatmapDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: HeatmapDay[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayOfYear = Math.floor(
      (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000
    );

    // Deterministic pseudo-random in [0, 1) based on dayOfYear.
    // Same day-of-year → same value, so heatmap is stable within a day.
    const seed = Math.sin(dayOfYear * 12.9898) * 43758.5453;
    const r = seed - Math.floor(seed);

    let level: 0 | 1 | 2 | 3 | 4 | 5 = 0;
    if (r > 0.45) {
      // ~55% of days have any activity.
      level = Math.min(5, Math.floor(r * 10) + 1) as 1 | 2 | 3 | 4 | 5;
    }
    const minutes = level > 0 ? level * 12 + Math.floor(r * 30) : 0;

    days.push({
      date: d.toISOString().slice(0, 10),
      level,
      minutes,
    });
  }
  return days;
}

// Per spec §13: 固定 mock streak (no real streak data yet).
export const MOCK_STREAK = {
  current: 12,
  longest: 38,
};

// Per spec §14: 本周 stats. newWords + reviewsCompleted are computed
// from real Supabase tables in StreakStats; minutes + daysStudied are
// mock for now (TODO: derive from session_timer localStorage or a
// daily_rollups table once available).
export const MOCK_WEEK = {
  minutes: 222, // 3h 42m
  daysStudied: 5,
};
