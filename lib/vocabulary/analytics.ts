// Mastery analytics for the /progress dashboard.
//
// Audit 2026-11-16 P0-1: these functions used to query
// vocabulary_reviews directly with no .range() call, so PostgREST capped
// every result at its default 1000 rows. With 3,347 saved words the
// progress page reported "总词数 1000" and "N2 586" while
// /vocabulary reported 3,347 and 2,009 for the same database.
//
// The aggregates now go through the get_vocab_stats() RPC (migration
// 0009), which computes exact counts inside Postgres. This module is
// the thin wrapper the page still imports.
//
// The RLS policies on vocabulary_items + vocabulary_reviews
// ("auth.uid() = user_id", defined in supabase/migrations/0003_vocabulary.sql)
// scope every row to the caller; the user_id filter below is redundant
// but kept for clarity.

import { createClient } from "@/lib/supabase/server";
import {
  getVocabStats,
  MASTERED_THRESHOLD,
  REVIEW_THRESHOLD,
  type MasteryByLevel,
  type MasteryDistribution,
  type MasteryStats,
} from "@/lib/vocabulary/stats";

export {
  MASTERED_THRESHOLD,
  REVIEW_THRESHOLD,
  type MasteryByLevel,
  type MasteryDistribution,
  type MasteryStats,
};

export type VocabWithMastery = {
  id: string; // vocabulary_reviews.id
  vocabulary_id: string;
  mastery: number;
  next_review_at: string | null;
  word: string;
  reading: string | null;
  meaning: string;
  level: string | null;
};

/**
 * 10 buckets: 0, 10, 20, ..., 90 (mastery floor of each).
 * `Math.min(9, ...)` caps mastery at the 90-100 bucket since we
 * never expect 100+ values, but the cap is defensive.
 */
export async function getMasteryDistribution(
  _userId: string
): Promise<MasteryDistribution[]> {
  const stats = await getVocabStats();
  return stats.distribution;
}

export async function getMasteryStats(_userId: string): Promise<MasteryStats> {
  const stats = await getVocabStats();
  return {
    total: stats.total,
    avg: stats.avgMastery,
    mastered: stats.mastered,
    needsReview: stats.needsReview,
    dueNow: stats.dueNow,
  };
}

export async function getMasteryByLevel(
  _userId: string
): Promise<MasteryByLevel[]> {
  const stats = await getVocabStats();
  return stats.byLevel;
}

/**
 * The "最需复习" / "已掌握" lists.
 *
 * Audit 2026-11-16 P0-1: the "已掌握 (≥80%)" list used to be built by
 * sorting mastery descending and taking the top N — with no threshold
 * filter. Since every item sat at 0% or 20% mastery, that list showed
 * 20%-mastery words under a "已掌握" heading. It now filters on the
 * threshold, so the list is empty rather than wrong.
 *
 * `order` decides which end of the scale we want:
 *   - "low"  -> lowest mastery, and only below REVIEW_THRESHOLD
 *                (the words that actually need work)
 *   - "high" -> highest mastery, and only at or above MASTERED_THRESHOLD
 */
export async function getVocabByMastery(
  userId: string,
  order: "low" | "high",
  limit: number,
  options?: { minMastery?: number; maxMastery?: number }
): Promise<VocabWithMastery[]> {
  const supabase = await createClient();
  const min = options?.minMastery;
  const max = options?.maxMastery;

  let query = supabase
    .from("vocabulary_reviews")
    .select(
      `
      id,
      vocabulary_id,
      mastery,
      next_review_at,
      vocabulary_items!inner ( word, reading, meaning, level )
    `
    )
    .eq("user_id", userId)
    // .range() beats the PostgREST 1000-row default cap — without it a
    // "limit 10" still ships the first 1000 rows to the server.
    .range(0, limit - 1);

  if (min !== undefined) query = query.gte("mastery", min);
  if (max !== undefined) query = query.lte("mastery", max);
  query = query.order("mastery", { ascending: order === "low" });

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("[analytics] getVocabByMastery:", error.message);
    return [];
  }

  return data.map((r) => {
    const v = r.vocabulary_items as unknown as {
      word: string;
      reading: string | null;
      meaning: string;
      level: string | null;
    };
    return {
      id: r.id,
      vocabulary_id: r.vocabulary_id,
      mastery: r.mastery ?? 0,
      word: v?.word ?? "",
      reading: v?.reading ?? null,
      meaning: v?.meaning ?? "",
      level: v?.level ?? null,
      next_review_at: r.next_review_at ?? null,
    };
  });
}
