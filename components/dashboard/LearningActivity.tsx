// Learning Activity heatmap — spec §16, §17. 365 days, hand-rolled SVG
// (per spec §21 "不要制造大量新的 UI 组件" → no react-calendar-heatmap).
//
// Reads from daily_rollups (Supabase) when available. Falls back to the
// fixed mock from lib/dashboard-mock.ts if the table is empty / missing
// / the user isn't logged in — so the UI never breaks (e.g. while the
// migration is still pending on the user's Supabase instance).

import { getDailyRollups } from "@/lib/daily-rollups";
import {
  buildHeatmapData,
  type HeatmapDay,
} from "@/lib/dashboard-mock";

// Tailwind fill-* / bg-* need to be statically detectable for the
// compiler to include them, so we list them explicitly here.
const LEVEL_FILL = [
  "fill-gray-100", // 0
  "fill-green-100", // 1
  "fill-green-200", // 2
  "fill-green-300", // 3
  "fill-green-400", // 4
  "fill-green-500", // 5
] as const;

const LEVEL_BG = [
  "bg-gray-100",
  "bg-green-100",
  "bg-green-200",
  "bg-green-300",
  "bg-green-400",
  "bg-green-500",
] as const;

function minutesToLevel(minutes: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 1;
  if (minutes < 30) return 2;
  if (minutes < 45) return 3;
  if (minutes < 60) return 4;
  return 5;
}

function realToHeatmap(rollups: Array<{ date: string; minutes: number }>): HeatmapDay[] {
  const map = new Map(rollups.map((r) => [r.date, r.minutes]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: HeatmapDay[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const minutes = map.get(dateStr) ?? 0;
    out.push({
      date: dateStr,
      level: minutesToLevel(minutes),
      minutes,
    });
  }
  return out;
}

export async function LearningActivity() {
  let data: HeatmapDay[] = buildHeatmapData(); // fallback
  let usingReal = false;

  try {
    const rollups = await getDailyRollups(365);
    if (rollups.length > 0) {
      data = realToHeatmap(rollups);
      usingReal = true;
    }
  } catch {
    // Supabase not ready / table missing / etc. — keep mock.
  }

  const totalDays = data.filter((d) => d.level > 0).length;
  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);
  const hours = Math.floor(totalMinutes / 60);

  // Group by week (rows = days-of-week, columns = weeks). 53 weeks.
  const weeks: typeof data[] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  const cellSize = 11;
  const gap = 2;
  const totalWidth = weeks.length * (cellSize + gap);
  const totalHeight = 7 * (cellSize + gap);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          学习足迹
        </h2>
        <span className="text-xs text-gray-400">
          过去一年{usingReal ? "" : " · 演示数据"}
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-4">
        学习天数：<span className="font-bold text-ink">{totalDays}</span>
        <span className="mx-2 text-gray-300">·</span>
        总学习时间：<span className="font-bold text-ink">{hours}h</span>
      </p>

      <div className="overflow-x-auto pb-2">
        <svg
          width={totalWidth}
          height={totalHeight}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="block"
          aria-label={`过去一年学习足迹，共 ${totalDays} 天学习`}
        >
          {weeks.map((week, wi) =>
            week.map((day, di) => (
              <rect
                key={`${wi}-${di}`}
                x={wi * (cellSize + gap)}
                y={di * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={2}
                className={LEVEL_FILL[day.level]}
              >
                <title>
                  {day.date}: {day.minutes} 分钟
                </title>
              </rect>
            ))
          )}
        </svg>
      </div>

      <div className="flex items-center justify-end gap-2 mt-2 text-xs text-gray-500">
        <span>少</span>
        {LEVEL_BG.map((cls, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-sm ${cls}`}
            aria-hidden="true"
          />
        ))}
        <span>多</span>
      </div>
    </section>
  );
}
