// UI 2.0 dashboard mock data sources.
// Per spec §13, §14: streak + week stats are now real (from localStorage
// via lib/today-stats.ts helpers). Only the heatmap is still fixed mock
// — will be wired to a daily_rollups Supabase table in a follow-up.
//
// Per spec §16: heatmap is fixed mock, NOT randomly refreshing.

export type HeatmapDay = {
  date: string; // YYYY-MM-DD
  level: 0 | 1 | 2 | 3 | 4 | 5;
  minutes: number;
};

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
