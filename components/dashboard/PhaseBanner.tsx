// Phase Banner — spec §18. Per audit 2026-10-09 P0-3: was a static
// decoration ("Phase 0 · 2026" + three aspirational sentences). Now it
// shows real progress toward the Phase 1 unlock criteria (a 30-day
// streak AND 300 saved vocab items) plus the three goals. This turns
// the bottom of the dashboard into something with a pulse instead of
// dead text.
//
// Server component — pulls daily_rollups + vocabulary_items count in
// parallel. Both queries are scoped by `user_id` and 365-day range so
// they stay small. Falls through to a "start here" CTA when both
// metrics are zero (nothing to show yet).

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PHASE1_STREAK_TARGET = 30; // days
const PHASE1_VOCAB_TARGET = 300; // words

// Standalone streak helper — same algorithm as lib/today-stats.ts'
// computeStreakFromDays but extracted here so the server-component
// import doesn't pull the whole client-side today-stats module
// (which has `useEffect` and would force this file into "use client").
function computeStreak(activeDays: Set<string>): {
  current: number;
  longest: number;
} {
  if (activeDays.size === 0) return { current: 0, longest: 0 };
  const sorted = Array.from(activeDays).sort();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / dayMs);
    if (diff === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // Current = count back from today (or yesterday — grace day so the
  // streak doesn't break before the user trains today).
  let current = 0;
  const lastMs = new Date(sorted[sorted.length - 1]).getTime();
  const daysSinceLast = Math.round((todayMs - lastMs) / dayMs);
  if (daysSinceLast <= 1) {
    current = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const a = new Date(sorted[i + 1]);
      const b = new Date(sorted[i]);
      if (Math.round((a.getTime() - b.getTime()) / dayMs) === 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, longest };
}

export async function PhaseBanner() {
  let streakLongest = 0;
  let streakCurrent = 0;
  let vocabCount = 0;

  try {
    const supabase = await createClient();
    if (!supabase) {
      // Audit 2026-10-09: dev-mode (no env vars) — fall through to zeros
      // instead of letting the null reference throw.
      return (
        <Banner streak={0} vocab={0} />
      );
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return <Banner streak={0} vocab={0} />;
    }

    // Run the two independent reads in parallel — neither depends on
    // the other. Rollups limited to 365 so the JSON payload stays
    // small (~365 rows of 2 fields).
    const [rollupsRes, vocabRes] = await Promise.all([
      supabase
        .from("daily_rollups")
        .select("date, minutes")
        .eq("user_id", user.id)
        .gte(
          "date",
          new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10)
        ),
      supabase
        .from("vocabulary_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    const rollups = (rollupsRes.data ?? []) as Array<{
      date: string;
      minutes: number;
    }>;
    const activeDays = new Set(
      rollups.filter((r) => r.minutes > 0).map((r) => r.date)
    );
    const streak = computeStreak(activeDays);
    streakCurrent = streak.current;
    streakLongest = streak.longest;
    vocabCount = vocabRes.count ?? 0;
  } catch {
    // Supabase down — fall through with zeros. Better than a 500.
  }

  return (
    <Banner
      streak={streakLongest}
      vocab={vocabCount}
      currentStreak={streakCurrent}
    />
  );
}

function Banner({
  streak,
  vocab,
  currentStreak,
}: {
  streak: number;
  vocab: number;
  currentStreak?: number;
}) {
  const streakPct = Math.min(
    100,
    Math.round((streak / PHASE1_STREAK_TARGET) * 100)
  );
  const vocabPct = Math.min(
    100,
    Math.round((vocab / PHASE1_VOCAB_TARGET) * 100)
  );
  // "Composite progress" — average of the two milestones so the bar
  // doesn't jump to 100% on whichever metric is easiest. Both must
  // reach the target to unlock Phase 1.
  const overallPct = Math.round((streakPct + vocabPct) / 2);
  const unlocked =
    streak >= PHASE1_STREAK_TARGET && vocab >= PHASE1_VOCAB_TARGET;

  return (
    <section className="py-12 border-t border-line">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide">
          {unlocked ? "Phase 1 已解锁 · 继续推进" : "Phase 0 · 2026"}
        </p>
        <p className="text-xs text-gray-400 tabular-nums">
          {overallPct}% → Phase 1
        </p>
      </div>

      <h2 className="font-sc text-2xl font-bold text-ink mb-2">重新开始</h2>
      <ul className="font-jp text-gray-700 space-y-1 mt-4 text-lg">
        <li>日本語を学ぶ。</li>
        <li>日本で働く。</li>
        <li>新しい生活を作る。</li>
      </ul>

      {/* Progress block — only render when there's at least one nonzero
          metric. For a brand-new account (0/0/0) it just adds noise. */}
      {(streak > 0 || vocab > 0) && (
        <div className="mt-8 max-w-xl space-y-4">
          <Progress
            label={`最长连续学习 ${streak} / ${PHASE1_STREAK_TARGET} 天`}
            pct={streakPct}
            current={
              typeof currentStreak === "number" ? `🔥 ${currentStreak} 天` : null
            }
          />
          <Progress
            label={`已掌握词汇 ${vocab} / ${PHASE1_VOCAB_TARGET} 词`}
            pct={vocabPct}
          />
        </div>
      )}

      {/* Empty-state nudge — shown only when both metrics are zero
          (account exists, no training yet). Pure dashboard new-user
          affordance; not duplicated for them by the hero CTAs. */}
      {streak === 0 && vocab === 0 && (
        <p className="mt-6 text-sm text-gray-400">
          还没有学习记录。
          <Link href="/vocabulary/new" className="text-ink hover:underline ml-1">
            添加第一个词
          </Link>
          ，开始 Phase 0 的第一步。
        </p>
      )}
    </section>
  );
}

function Progress({
  label,
  pct,
  current,
}: {
  label: string;
  pct: number;
  current?: string | null;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <p className="text-sm text-gray-700 tabular-nums">{label}</p>
        {current && (
          <p className="text-sm text-gray-500 tabular-nums">{current}</p>
        )}
      </div>
      <div
        className="h-1.5 rounded-full bg-gray-200 overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-ink rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}