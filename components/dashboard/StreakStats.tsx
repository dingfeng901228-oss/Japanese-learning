// Streak + 本周 stats — spec §13, §14.
// Server component. Streak + week minutes/days are mock (no real
// data yet). New words + reviews completed are real counts from
// Supabase vocabulary tables (last 7 days).

import { createClient } from "@/lib/supabase/server";
import { MOCK_STREAK, MOCK_WEEK } from "@/lib/dashboard-mock";

function formatWeekMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h ${min}m`;
}

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
      <div className="flex items-center gap-4">
        <span className="text-3xl" aria-hidden="true">
          🔥
        </span>
        <div>
          <p className="text-3xl font-bold tabular-nums text-ink">
            {MOCK_STREAK.current}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            日连续学习 · 最长 {MOCK_STREAK.longest} 天
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-line">
        <Stat label="本周学习" value={formatWeekMinutes(MOCK_WEEK.minutes)} />
        <Stat label="学习天数" value={`${MOCK_WEEK.daysStudied} / 7`} />
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
