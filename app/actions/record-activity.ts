"use server";

// Server action: record a training session's activity to daily_rollups.
// Called from useSessionTimer / accumulateMinutes in lib/today-stats.ts
// after every training page unmount, so the server-side rollup stays in
// sync with the localStorage source of truth.

import { createClient } from "@/lib/supabase/server";

export async function recordDailyActivity(
  date: string,
  minutes: number,
  tasksCompleted: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase.rpc("upsert_daily_rollup", {
      p_user_id: user.id,
      p_date: date,
      p_minutes: minutes,
      p_tasks_completed: tasksCompleted,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
