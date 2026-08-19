"use client";

// Phase 7 (#6295): read daily_rollups from Supabase instead of scanning
// localStorage. Makes streak + week minutes cross-device (per Frank's
// request). `accumulateMinutes` in lib/today-stats.ts already fires the
// server action recordDailyActivity (per Frank #6280) so the writes are
// already happening — we just need the read side to pull from Supabase.
//
// Phase 7+ (#6307): add a 5-minute background poll so a dashboard tab
// that's been open for hours without the user switching focus still
// sees fresh minutes. Skips the 0:00-5:59 quiet window so we don't
// hammer Supabase while the user is asleep.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type DailyRollup = {
  date: string; // YYYY-MM-DD
  minutes: number;
  tasks_completed: number;
};

// Quiet hours: 0:00-5:59 local time. Per Frank #6307 we don't poll
// the dashboard during the night. The early return inside `refresh`
// means every trigger (initial mount, focus, visibility, interval)
// respects the window — no per-call-site checks needed.
function isQuietHour(): boolean {
  const hour = new Date().getHours();
  return hour >= 0 && hour < 6;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useDailyRollups(days: number = 365) {
  const [data, setData] = useState<DailyRollup[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (isQuietHour()) {
      // Don't burn a Supabase round-trip while the user is asleep.
      // If data was previously loaded, keep showing it (the cached
      // minute-by-minute view is still correct for the day it's on).
      setLoading(false);
      return;
    }
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - days + 1);

      const { data: rollups, error } = await supabase
        .from("daily_rollups")
        .select("date, minutes, tasks_completed")
        .eq("user_id", user.id)
        .gte("date", startDate.toISOString().slice(0, 10))
        .lte("date", today.toISOString().slice(0, 10));

      if (!error && rollups) {
        setData(
          (rollups as Array<DailyRollup>).map((r) => ({
            date: typeof r.date === "string" ? r.date : String(r.date),
            minutes: Number(r.minutes) || 0,
            tasks_completed: Number(r.tasks_completed) || 0,
          }))
        );
      }
    } catch {
      // Supabase not ready — leave data as empty array, caller will show 0s.
    } finally {
      setLoading(false);
    }
  }, [days]);

  // Initial mount — fetches once if we're not in the quiet window.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh on focus + visibility change so when the user comes back
  // from /listening or /speaking (which call recordDailyActivity
  // server-side), the dashboard sees the fresh minutes without a manual
  // reload. The quiet-hours check inside `refresh` automatically
  // suppresses these during 0:00-5:59 too.
  useEffect(() => {
    function onFocus() {
      refresh();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  // Background poll every 5 minutes (per Frank #6307). Bails out
  // during the quiet window via the early return in `refresh`.
  useEffect(() => {
    const id = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { data, loading, refresh };
}
