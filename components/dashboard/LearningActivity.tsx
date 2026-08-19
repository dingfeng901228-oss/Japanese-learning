// Learning Activity — server wrapper that fetches daily_rollups +
// hands off rendering to the interactive client component.
//
// Per Frank #6246: real data ONLY. No mock fallback. If the table is
// empty (user hasn't trained yet), fill the past 365 days with 0s so
// the chart shows the accurate empty state (not fake demo data).

import { getDailyRollups } from "@/lib/daily-rollups";
import { LearningActivityClient } from "./LearningActivityClient";

export async function LearningActivity() {
  let rollups: Array<{ date: string; minutes: number }> = [];
  try {
    const data = await getDailyRollups(365);
    rollups = data.map((r) => ({
      date: typeof r.date === "string" ? r.date : String(r.date),
      minutes: Number(r.minutes) || 0,
    }));
  } catch {
    // Supabase not ready / table missing / etc. — fall through to 0s.
  }

  // Always use real data shape. If table returned nothing, fill 365
  // days of 0 so the chart honestly shows "no training yet".
  let data: Array<{ date: string; minutes: number }>;
  if (rollups.length > 0) {
    data = rollups;
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    data = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      data.push({
        date: d.toISOString().slice(0, 10),
        minutes: 0,
      });
    }
  }

  const totalDays = data.filter((d) => d.minutes > 0).length;
  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const peakMinutes = Math.max(...data.map((d) => d.minutes), 0);

  return (
    <LearningActivityClient
      data={data}
      totalDays={totalDays}
      totalHours={hours}
      peakMinutes={peakMinutes}
    />
  );
}
