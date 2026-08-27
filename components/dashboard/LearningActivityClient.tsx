"use client";

// Learning Activity line chart — interactive (client component).
// Per Frank #6236:
//   - Default to last 1 month (range selector: 1M / 3M / 6M / 1Y)
//   - Hover shows date + minutes + crosshair + highlighted point
//   - Larger chart (200px tall, full width on the page)

import { useMemo, useState } from "react";

type Range = "1M" | "3M" | "6M" | "1Y";

const RANGE_DAYS: Record<Range, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
};

const RANGE_LABELS: Record<Range, string> = {
  "1M": "1月",
  "3M": "3月",
  "6M": "6月",
  "1Y": "1年",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export interface LearningActivityClientProps {
  data: Array<{ date: string; minutes: number }>;
  totalDays: number;
  totalHours: number;
  peakMinutes: number;
}

export function LearningActivityClient({
  data,
  totalDays,
  totalHours: _totalHours,
  peakMinutes,
}: LearningActivityClientProps) {
  const [range, setRange] = useState<Range>("1M");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    return data.slice(-days);
  }, [data, range]);

  // SVG dimensions — larger than before (200px tall, was 120px).
  const width = 800;
  const height = 200;
  const padding = { top: 16, right: 8, bottom: 28, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxMinutes = Math.max(
    Math.max(...filtered.map((d) => d.minutes), 0),
    30
  );

  // Per Frank #6325: "总学习时间 0h" looked empty when total was 3.4 min
  // (the server-rendered totalHours = floor(min/60) rounds down to 0).
  // Compute from data here and show "Xh Ym" / "Xm" / "Xh" so anything
  // > 0 is visible.
  const totalMinutes = data.reduce((s, d) => s + d.minutes, 0);
  const totalH = Math.floor(totalMinutes / 60);
  const totalM = Math.round(totalMinutes % 60);
  const totalDisplay =
    totalH > 0
      ? totalM > 0
        ? `${totalH}h ${totalM}m`
        : `${totalH}h`
      : `${totalM}m`;

  const pts = filtered.map((d, i) => ({
    x:
      padding.left +
      (i / Math.max(1, filtered.length - 1)) * chartWidth,
    y:
      padding.top +
      chartHeight -
      (d.minutes / maxMinutes) * chartHeight,
    date: d.date,
    minutes: d.minutes,
  }));

  const path = pointsToSmoothPath(pts);
  const areaPath = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${(
    padding.top + chartHeight
  ).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padding.top + chartHeight).toFixed(1)} Z`;

  // Month labels at first occurrence of each month.
  const monthLabels: Array<{ x: number; label: string }> = [];
  let lastMonth = -1;
  for (let i = 0; i < filtered.length; i++) {
    const m = new Date(filtered[i].date).getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ x: pts[i].x, label: MONTHS[m] });
      lastMonth = m;
    }
  }

  // Hover handling — find the closest data point to the mouse.
  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - x);
      if (d < minDist) {
        minDist = d;
        closest = i;
      }
    }
    setHoverIdx(closest);
  }

  const hoverPoint = hoverIdx !== null ? pts[hoverIdx] : null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          学习足迹
        </h2>
        <span className="text-xs text-gray-400">过去一年</span>
      </div>

      <p className="text-sm text-gray-700 mb-4">
        总共学习：<span className="font-bold text-ink">{totalDisplay}</span>
        <span className="mx-2 text-gray-300">·</span>
        最高：<span className="font-bold text-ink">{peakMinutes} 分</span>
      </p>

      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 text-xs">
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                range === r
                  ? "bg-ink text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        {hoverPoint && (
          <div className="text-xs text-gray-700 tabular-nums">
            <span className="font-medium">{hoverPoint.date}</span>
            <span className="mx-2 text-gray-300">·</span>
            <span className="font-bold text-ink">
              {Math.round(hoverPoint.minutes)} 分
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-2">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full max-w-full"
          preserveAspectRatio="none"
          aria-label={`过去${RANGE_LABELS[range]}学习足迹`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <path d={areaPath} className="fill-accent/10" />
          <path
            d={path}
            className="stroke-ink fill-none"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Per Frank #6725: data points now use donut style (white
             fill + ink stroke) so they pop against the dark line at
             any zoom level. Default r=2.5 (was 1.6) + opacity-90
             (was 60) for stronger contrast; hover dot is r=5 with
             inverted colors (ink fill + white halo) so the active
             point reads as a distinct "selected" state. Per Frank #6671
             we still skip dots for minutes == 0 to keep the "no
             training yet" line clean, and the dots still render
             AFTER the path so they sit on top of the line; hover
             crosshair + larger dot render last to overlay on top. */}
          {pts.map((p, i) =>
            p.minutes > 0 ? (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="2.5"
                strokeWidth="1.5"
                className="fill-white stroke-ink opacity-90"
              />
            ) : null
          )}
          {hoverPoint && (
            <>
              <line
                x1={hoverPoint.x}
                y1={padding.top}
                x2={hoverPoint.x}
                y2={padding.top + chartHeight}
                className="stroke-ink/20"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r="5"
                strokeWidth="2"
                className="fill-ink stroke-white"
              />
            </>
          )}
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={m.x}
              y={height - 8}
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

// Catmull-Rom → cubic Bezier (tension 0.5). Smooths the spikes that a
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
