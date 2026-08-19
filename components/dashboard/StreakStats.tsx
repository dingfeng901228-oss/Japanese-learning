// Streak + 本周 stats — spec §13, §14.
// Server component for the real Supabase counts (新增单词 / 完成复习).
// Streak + week stats are real client components that read localStorage
// (see StreakCounter.tsx + WeekStats.tsx).

import { createClient } from "@/lib/supabase/server";
import { StreakCounter } from "@/components/dashboard/StreakCounter";
import { WeekStats } from "@/components/dashboard/WeekStats";

export async function StreakStats() {
  let newWords = 0;
  let reviewsCompleted = 0;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { count: wordCount } = await supabase
        .from("vocabulary_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", weekAgo.toISOString());
      newWords = wordCount ?? 0;

      const { count: reviewCount } = await supabase
        .from("vocabulary_reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("reviewed_at", weekAgo.toISOString());
      reviewsCompleted = reviewCount ?? 0;
    }
  } catch {
    // Supabase down / not configured — fall back to 0, don't crash.
  }

  return (
    <section className="space-y-6">
      <StreakCounter />

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-line">
        <WeekStats />
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
