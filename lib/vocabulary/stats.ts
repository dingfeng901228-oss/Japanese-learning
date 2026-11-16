// Server-side vocabulary statistics — the single source of truth for
// the numbers shown on the home page, /vocabulary and /progress.
//
// Audit 2026-11-16 P0-1. Before this module the three pages computed
// their own numbers and disagreed:
//
//   /vocabulary  "共 3347 项"   (exact count, count:"exact")
//   /progress    "总词数 1000"  (PostgREST's default 1000-row cap —
//                                the query had no .range())
//   home         "已掌握词汇 3347" (that was the SAVED count, mislabelled
//                                as mastered — real mastery is 0)
//
// Everything here goes through the get_vocab_stats() RPC (migration
// 0009) so the counts are exact and identical on every page. The RPC
// is SECURITY INVOKER, so the existing RLS policies scope it to the
// caller — no user_id is passed in.
//
// Activity (minutes / streak) comes from daily_rollups, which is the
// server-side twin of the localStorage timers in lib/today-stats.ts.
// The two used to disagree because useDailyRollups() skips its fetch
// during quiet hours (00:00-05:59) and then renders zeros, while the
// server components always query. Everything below is server-rendered
// now, so there is only one number.

import { createClient } from "@/lib/supabase/server";

/** Mastery at or above this counts as 已掌握. */
export const MASTERED_THRESHOLD = 80;
/** Mastery below this counts as 待复习 / 最需复习. */
export const REVIEW_THRESHOLD = 50;

export type MasteryStats = {
  total: number;
  avg: number;
  // Mastery >= MASTERED_THRESHOLD — usually means 8+ successful reviews.
  mastered: number;
  // Mastery < REVIEW_THRESHOLD — the items the user keeps getting wrong
  // or hasn't reviewed yet (initial state is mastery=0).
  needsReview: number;
  // Items whose next_review_at is in the past — due in /review now.
  dueNow: number;
};

export type MasteryDistribution = {
  /** mastery bucket floor: 0, 10, 20, ..., 90 */
  bucket: number;
  count: number;
};

export type MasteryByLevel = {
  /** N5, N4, ..., N1, or "未指定" */
  level: string;
  count: number;
  avg: number;
};

export type VocabStats = {
  /** total saved words */
  total: number;
  /** mastery >= MASTERED_THRESHOLD */
  mastered: number;
  /** mastery < REVIEW_THRESHOLD */
  needsReview: number;
  /** next_review_at in the past — due for review now */
  dueNow: number;
  /** average mastery, 0-100 */
  avgMastery: number;
  /** per JLPT level, easiest first */
  byLevel: MasteryByLevel[];
  /** mastery histogram, buckets of 10 */
  distribution: MasteryDistribution[];
};

export type ActivityStats = {
  /** minutes logged today (server, daily_rollups) */
  todayMinutes: number;
  /** minutes logged in the last 7 days */
  weekMinutes: number;
  /** minutes logged in the last 365 days */
  totalMinutes: number;
  /** consecutive active days ending today or yesterday */
  currentStreak: number;
  /** longest run of consecutive active days ever */
  longestStreak: number;
  /** number of days with activity in the last 365 */
  activeDays: number;
};

export const EMPTY_VOCAB_STATS: VocabStats = {
  total: 0,
  mastered: 0,
  needsReview: 0,
  dueNow: 0,
  avgMastery: 0,
  byLevel: [],
  distribution: [],
};

export const EMPTY_ACTIVITY_STATS: ActivityStats = {
  todayMinutes: 0,
  weekMinutes: 0,
  totalMinutes: 0,
  currentStreak: 0,
  longestStreak: 0,
  activeDays: 0,
};

/**
 * Exact vocabulary statistics. Returns zeros (never throws) when the
 * database is unreachable or the user is not signed in — a stats panel
 * is not worth a 500.
 */
export async function getVocabStats(): Promise<VocabStats> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return EMPTY_VOCAB_STATS;

    const { data, error } = await supabase.rpc("get_vocab_stats", {
      p_mastered_threshold: MASTERED_THRESHOLD,
      p_review_threshold: REVIEW_THRESHOLD,
    });
    if (error || !data) {
      if (error) console.error("[stats] get_vocab_stats:", error.message);
      return EMPTY_VOCAB_STATS;
    }

    // The RPC returns snake_case keys — map them onto the camelCase
    // shape the rest of the app uses.
    const raw = data as {
      total?: number;
      mastered?: number;
      needs_review?: number;
      due_now?: number;
      avg_mastery?: number;
      by_level?: MasteryByLevel[];
      distribution?: MasteryDistribution[];
    };
    return {
      total: Number(raw.total ?? 0),
      mastered: Number(raw.mastered ?? 0),
      needsReview: Number(raw.needs_review ?? 0),
      dueNow: Number(raw.due_now ?? 0),
      avgMastery: Number(raw.avg_mastery ?? 0),
      byLevel: Array.isArray(raw.by_level) ? raw.by_level : [],
      distribution: Array.isArray(raw.distribution) ? raw.distribution : [],
    };
  } catch (err) {
    if ((err as Error).message !== "supabase_env_missing") {
      console.error("[stats] getVocabStats failed:", err);
    }
    return EMPTY_VOCAB_STATS;
  }
}

/**
 * Streak + minutes from daily_rollups — the server-side twin of the
 * localStorage timers.
 *
 * The streak algorithm matches computeStreakFromDays() in
 * lib/today-stats.ts (grace day: a streak survives if the last active
 * day is yesterday).
 */
export async function getActivityStats(): Promise<ActivityStats> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return EMPTY_ACTIVITY_STATS;

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 364);

    const { data, error } = await supabase
      .from("daily_rollups")
      .select("date, minutes")
      .eq("user_id", user.id)
      .gte("date", start.toISOString().slice(0, 10))
      .lte("date", today.toISOString().slice(0, 10));
    if (error) {
      console.error("[stats] getActivityStats:", error.message);
      return EMPTY_ACTIVITY_STATS;
    }

    const rows = (data ?? []) as Array<{ date: string; minutes: number }>;
    const minutesByDate = new Map<string, number>();
    for (const r of rows) {
      minutesByDate.set(r.date, Number(r.minutes) || 0);
    }

    const todayKey = today.toISOString().slice(0, 10);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoKey = weekAgo.toISOString().slice(0, 10);

    let todayMinutes = 0;
    let weekMinutes = 0;
    let totalMinutes = 0;
    for (const [date, minutes] of minutesByDate) {
      totalMinutes += minutes;
      if (date === todayKey) todayMinutes += minutes;
      if (date >= weekAgoKey) weekMinutes += minutes;
    }

    const activeDays = new Set(
      rows.filter((r) => (Number(r.minutes) || 0) > 0).map((r) => r.date)
    );
    const { current, longest } = computeStreak(activeDays);

    return {
      todayMinutes: round1(todayMinutes),
      weekMinutes: round1(weekMinutes),
      totalMinutes: round1(totalMinutes),
      currentStreak: current,
      longestStreak: longest,
      activeDays: activeDays.size,
    };
  } catch (err) {
    if ((err as Error).message !== "supabase_env_missing") {
      console.error("[stats] getActivityStats failed:", err);
    }
    return EMPTY_ACTIVITY_STATS;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Streak from a set of active dates (YYYY-MM-DD).
 *
 * Kept in sync with computeStreakFromDays() in lib/today-stats.ts:
 *  - current streak counts back from today, with a grace day (yesterday)
 *  - longest streak walks the sorted dates and resets on a gap
 */
export function computeStreak(activeDays: Set<string>): {
  current: number;
  longest: number;
} {
  if (activeDays.size === 0) return { current: 0, longest: 0 };

  const sorted = Array.from(activeDays).sort();
  const dayMs = 24 * 60 * 60 * 1000;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00Z`).getTime();
    const curr = new Date(`${sorted[i]}T00:00:00Z`).getTime();
    if (Math.round((curr - prev) / dayMs) === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // Grace day: the streak survives if the last active day is today or
  // yesterday, so opening the app before training does not zero it.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayKey = localDateKey(today);
  const yesterdayKey = localDateKey(yesterday);

  let current = 0;
  const lastDay = sorted[sorted.length - 1];
  if (lastDay === todayKey || lastDay === yesterdayKey) {
    current = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const a = new Date(`${sorted[i + 1]}T00:00:00Z`).getTime();
      const b = new Date(`${sorted[i]}T00:00:00Z`).getTime();
      if (Math.round((a - b) / dayMs) === 1) current += 1;
      else break;
    }
  }

  return { current, longest };
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "46h 3m" — the house format for a minute count. */
export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}
