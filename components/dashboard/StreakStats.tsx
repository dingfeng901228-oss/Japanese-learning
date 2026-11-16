// Streak + 本周 stats — spec §13, §14.
//
// Audit 2026-11-16 P0-1: this component used to mix three sources on
// one screen — the streak and week minutes came from a client-side
// fetch of daily_rollups (which skips quiet hours and then shows 0),
// while "新增单词 / 完成复习" came from the server. The home page also
// showed a server-side "学习足迹 过去一年 46h 3m" from the same table,
// so "本周学习 0h 0m" and "46h 3m" sat next to each other and the
// longest streak appeared twice with different values.
//
// Everything now comes from one server read (lib/vocabulary/stats.ts):
//   - streak + minutes  -> daily_rollups via getActivityStats()
//   - word/review counts -> vocabulary_items / vocabulary_reviews
//
// The counts below are server-side counts. The localStorage-backed
// sections further down /progress are labelled separately — see
// client-progress.tsx.

import { createClient } from "@/lib/supabase/server";
import { getActivityStats, formatHM } from "@/lib/vocabulary/stats";
import { StreakCounter } from "@/components/dashboard/StreakCounter";
import { WeekStats } from "@/components/dashboard/WeekStats";

export async function StreakStats() {
  let newWords = 0;
  let reviewsCompleted = 0;
  let weekMinutes = 0;
  let totalMinutes = 0;
  let todayMinutes = 0;
  let currentStreak = 0;
  let longestStreak = 0;

  try {
    const supabase = await createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const weekAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();
        const [activity, wordCount, reviewCount] = await Promise.all([
          getActivityStats(),
          supabase
            .from("vocabulary_items")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", weekAgo),
          supabase
            .from("vocabulary_reviews")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("reviewed_at", weekAgo),
        ]);
        weekMinutes = activity.weekMinutes;
        totalMinutes = activity.totalMinutes;
        todayMinutes = activity.todayMinutes;
        currentStreak = activity.currentStreak;
        longestStreak = activity.longestStreak;
        newWords = wordCount.count ?? 0;
        reviewsCompleted = reviewCount.count ?? 0;
      }
    }
  } catch {
    // Supabase down / not configured — fall back to 0, don't crash.
  }

  return (
    <section className="space-y-6">
      <StreakCounter current={currentStreak} longest={longestStreak} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-line">
        <WeekStats weekMinutes={weekMinutes} totalMinutes={totalMinutes} />
        <Stat label="今日学习" value={formatHM(todayMinutes)} />
        <Stat label="新增单词" value={`+${newWords}`} />
        <Stat label="完成复习" value={reviewsCompleted.toString()} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}
