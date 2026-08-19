// Learning Activity — server wrapper that fetches daily_rollups +
// hands off rendering to the interactive client component.
//
// Per Frank #6236: heatmap → line chart. Hover + range selector need
// client-side state, so the SVG + interactivity live in
// LearningActivityClient.tsx.

import { getDailyRollups } from "@/lib/daily-rollups";
import { buildHeatmapData } from "@/lib/dashboard-mock";
import { LearningActivityClient } from "./LearningActivityClient";

export async function LearningActivity() {
  let realData: Array<{ date: string; minutes: number }> = [];
  try {
    const rollups = await getDailyRollups(365);
    realData = rollups.map((r) => ({
      date: typeof r.date === "string" ? r.date : String(r.date),
      minutes: Number(r.minutes) || 0,
    }));
  } catch {
    // Supabase not ready / table missing / etc. — fall back to mock.
  }

  let data: Array<{ date: string; minutes: number }>;
  let usingReal = false;

  if (realData.length > 0) {
    data = realData;
    usingReal = true;
  } else {
    data = buildHeatmapData().map((d) => ({
      date: d.date,
      minutes: d.minutes,
    }));
  }

  const totalDays = data.filter((d) => d.minutes > 0).length;
  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const peakMinutes = Math.max(...data.map((d) => d.minutes), 0);

  return (
    <LearningActivityClient
      data={data}
      usingReal={usingReal}
      totalDays={totalDays}
      totalHours={hours}
      peakMinutes={peakMinutes}
    />
  );
}
