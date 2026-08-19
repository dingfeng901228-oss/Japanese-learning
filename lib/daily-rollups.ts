// Server-side data access for daily_rollups.
// Used by Server Components to read the heatmap (LearningActivity) and
// by the recordDailyActivity server action to write per-session
// activity.

import { createClient } from "@/lib/supabase/server";

export type DailyRollup = {
  user_id: string;
  date: string; // YYYY-MM-DD
  minutes: number;
  tasks_completed: number;
  created_at: string;
  updated_at: string;
};

export async function getDailyRollups(days: number): Promise<DailyRollup[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days + 1);

  const { data, error } = await supabase
    .from("daily_rollups")
    .select("user_id, date, minutes, tasks_completed, created_at, updated_at")
    .eq("user_id", user.id)
    .gte("date", startDate.toISOString().slice(0, 10))
    .lte("date", today.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as DailyRollup[];
}
