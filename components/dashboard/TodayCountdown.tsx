"use client";

// TodayCountdown — live HH:MM:SS countdown to end of day (per Frank #6615).
//
// Used on the home page so the user always sees how much of today's
// training window is left. Reuses getTimeUntilMidnight() from
// lib/today-stats.ts so the formula stays in one place (the same one
// is inlined on /today).
//
// Renders nothing meaningful until mount (SSR-safe — no hydration
// mismatch on the seconds digit), then ticks every second.

import { useEffect, useState } from "react";
import {
  getTimeUntilMidnight,
  type CountdownParts,
} from "@/lib/today-stats";

export function TodayCountdown() {
  const [countdown, setCountdown] = useState<CountdownParts | null>(null);

  useEffect(() => {
    setCountdown(getTimeUntilMidnight());
    const id = window.setInterval(() => {
      setCountdown(getTimeUntilMidnight());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p
      className="mt-2 text-sm text-gray-500 tabular-nums"
      aria-live="polite"
    >
      距离今天结束还有{" "}
      <span className="font-semibold text-gray-700">
        {countdown
          ? `${String(countdown.hours).padStart(2, "0")}:${String(countdown.minutes).padStart(2, "0")}:${String(countdown.seconds).padStart(2, "0")}`
          : "--:--:--"}
      </span>
    </p>
  );
}