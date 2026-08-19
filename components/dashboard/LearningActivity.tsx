// Learning Activity line chart — spec §16 (originally heatmap).
// Per Frank #6227: switch from heatmap to a 365-day line chart.
//
// Reads from daily_rollups (Supabase) when available. Falls back to the
// fixed mock from lib/dashboard-mock.ts if the table is empty /
// migration pending / user isn't logged in.

import { getDailyRollups } from "@/lib/daily-rollups";
import { buildHeatmapData } from "@/lib/dashboard-mock";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

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

  // SVG dimensions
  const width = 600;
  const height = 120;
  const padding = { top: 12, right: 0, bottom: 22, left: 0 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  // Use a sensible Y-axis ceiling so a single heavy day doesn't
  // flatten the rest of the line.
  const maxMinutes = Math.max(peakMinutes, 30);

  const pts = data.map((d, i) => ({
    x: padding.left + (i / Math.max(1, data.length - 1)) * chartWidth,
    y:
      padding.top +
      chartHeight -
      (d.minutes / maxMinutes) * chartHeight,
    date: d.date,
    minutes: d.minutes,
  }));

  // Smooth line via Catmull-Rom → cubic Bezier (tension 0.5).
  const path = pointsToSmoothPath(pts);
  const areaPath = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${(
    padding.top + chartHeight
  ).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padding.top + chartHeight).toFixed(1)} Z`;

  // Month labels at the first occurrence of each month.
  const monthLabels: Array<{ x: number; label: string }> = [];
  let lastMonth = -1;
  for (let i = 0; i < data.length; i++) {
    const m = new Date(data[i].date).getMonth();
    if (m !== lastMonth) {
      monthLabels.push({
        x: pts[i].x,
        label: MONTHS[m],
      });
      lastMonth = m;
    }
  }

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
        <span className="mx-2 text-gray-300">·</span>
        最高：<span className="font-bold text-ink">{peakMinutes} 分</span>
      </p>

      <div className="overflow-x-auto pb-2">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full max-w-full"
          preserveAspectRatio="none"
          aria-label={`过去一年学习足迹，共 ${totalDays} 天学习`}
        >
          <path d={areaPath} className="fill-accent/10" />
          <path
            d={path}
            className="stroke-ink fill-none"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={m.x}
              y={height - 6}
              fontSize="10"
              className="fill-gray-400"
              textAnchor="middle"
            >
              {m.label}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

// Catmull-Rom smoothing → cubic Bezier path. Avoids sharp spikes that
// straight `L` line would produce on daily-rollup data.
function pointsToSmoothPath(
  pts: Array<{ x: number; y: number }>
): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const tension = 0.5;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 6;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 6;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 6;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
