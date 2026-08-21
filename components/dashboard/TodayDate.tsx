"use client";

// TodayDate — client-only date display that rolls over at midnight.
//
// Used inside TodayHeader so the visible date on the home page always
// matches the user's local day, even when they leave the page open
// across the 00:00 boundary.
//
// On day-roll-over we also call router.refresh() so server-side data
// (most importantly LearningActivity's daily_rollups) is re-fetched
// with the new "today". One tiny client trigger refreshes the whole
// server tree — keeps client state minimal and ensures every server
// component sees the correct date.
//
// SSR-safe: renders a placeholder until mount to avoid hydration
// mismatch (Node.js clock vs browser clock).
//
// (Frank #6631: home page date + 学习足迹 hover dates didn't update
// across midnight.)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const JA_WEEKDAYS = [
  "日曜日", // 0 Sunday
  "月曜日", // 1 Monday
  "火曜日", // 2 Tuesday
  "水曜日", // 3 Wednesday
  "木曜日", // 4 Thursday
  "金曜日", // 5 Friday
  "土曜日", // 6 Saturday
];

export function TodayDate() {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);

  // Tick every 60 s. We don't need 1-Hz because we only care about
  // day boundaries; the per-second ticker is handled by TodayCountdown.
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Detect day-roll-over and ask the server tree to re-render.
  // toDateString() is locale-stable ("Sat Aug 22 2026" form) so a
  // string compare is enough to spot midnight crossings.
  const todayKey = now ? now.toDateString() : "";
  const [lastKey, setLastKey] = useState(todayKey);
  useEffect(() => {
    if (todayKey && todayKey !== lastKey) {
      setLastKey(todayKey);
      router.refresh();
    }
  }, [todayKey, lastKey, router]);

  if (!now) {
    // Pre-mount / SSR placeholder so the row doesn't jump.
    return <span className="tabular-nums">--</span>;
  }

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekday = JA_WEEKDAYS[now.getDay()];

  return (
    <span className="tabular-nums">
      {year}年{month}月{day}日 · {weekday}
    </span>
  );
}
