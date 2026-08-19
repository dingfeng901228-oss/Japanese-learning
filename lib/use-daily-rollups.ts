"use client";

// Phase 7 (#6295): read daily_rollups from Supabase instead of scanning
// localStorage. Makes streak + week minutes cross-device (per Frank's
// request). `accumulateMinutes` in lib/today-stats.ts already fires the
// server action recordDailyActivity (per Frank #6280) so the writes are
// already happening — we just need the read side to pull from Supabase.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type DailyRollup = {
  date: string; // YYYY-MM-DD
  minutes: number;
  tasks_completed: number;
};

export function useDailyRollups(days: number = 365) {
  const [data, setData] = useState<DailyRollup[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh on focus + visibility change so when the user comes back from
  // /listening or /speaking (which call recordDailyActivity server-side),
  // the dashboard sees the fresh minutes without a manual reload.
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

  return { data, loading, refresh };
}