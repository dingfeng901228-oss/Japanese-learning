// Mastery analytics for the /progress dashboard.
//
// Queries the vocabulary_reviews table (Supabase) and returns
// aggregate stats: distribution histogram, overall mastery, per-JLPT
// breakdown, and "needs review" / "top mastered" lists. Called from
// the Server Component app/progress/page.tsx.
//
// All queries are scoped to the current user via the RLS policies on
// vocabulary_reviews + vocabulary_items (defined in
// supabase/migrations/0003_vocabulary.sql), so the user_id filter is
// redundant — kept for clarity.

import { createClient } from "@/lib/supabase/server";

export type MasteryDistribution = {
  bucket: number; // 0, 10, 20, ..., 90 (bucket floor)
  count: number;
};

export type MasteryStats = {
  total: number;
  avg: number;
  // Mastery >= 80 — usually means 8+ successful reviews on this item.
  mastered: number;
  // Mastery < 50 — these are the items the user keeps getting wrong
  // or hasn't reviewed yet (initial state is mastery=0).
  needsReview: number;
  // Items whose next_review_at is in the past — due in /review now.
  dueNow: number;
};

export type MasteryByLevel = {
  level: string; // N5, N4, ..., N1, or "未指定"
  count: number;
  avg: number;
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

// 10 buckets: 0, 10, 20, ..., 90 (mastery floor of each).
// `Math.min(9, ...)` caps mastery at the 90-100 bucket since we
// never expect 100+ values, but the cap is defensive.
export async function getMasteryDistribution(
  userId: string
): Promise<MasteryDistribution[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vocabulary_reviews")
    .select("mastery")
    .eq("user_id", userId);

  if (error) {
    console.error("getMasteryDistribution:", error);
    return [];
  }

  const buckets = new Map<number, number>();
  for (let i = 0; i < 10; i++) buckets.set(i * 10, 0);

  for (const r of data ?? []) {
    const m = r.mastery ?? 0;
    const bucket = Math.min(9, Math.floor(m / 10)) * 10;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => a.bucket - b.bucket);
}

export async function getMasteryStats(userId: string): Promise<MasteryStats> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("vocabulary_reviews")
    .select("mastery, next_review_at")
    .eq("user_id", userId);

  if (error || !data) {
    return { total: 0, avg: 0, mastered: 0, needsReview: 0, dueNow: 0 };
  }

  const total = data.length;
  const sum = data.reduce((s, r) => s + (r.mastery ?? 0), 0);
  const avg = total > 0 ? Math.round(sum / total) : 0;
  const mastered = data.filter((r) => (r.mastery ?? 0) >= 80).length;
  const needsReview = data.filter((r) => (r.mastery ?? 0) < 50).length;
  const dueNow = data.filter(
    (r) => r.next_review_at && r.next_review_at <= nowIso
  ).length;

  return { total, avg, mastered, needsReview, dueNow };
}

export async function getMasteryByLevel(
  userId: string
): Promise<MasteryByLevel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vocabulary_reviews")
    .select(
      `
      mastery,
      vocabulary_items!inner ( level )
    `
    )
    .eq("user_id", userId);

  if (error || !data) return [];

  const byLevel = new Map<string, { count: number; sum: number }>();
  for (const r of data) {
    const v = r.vocabulary_items as unknown as { level: string | null };
    const lvl = v?.level ?? "未指定";
    const m = r.mastery ?? 0;
    const cur = byLevel.get(lvl) ?? { count: 0, sum: 0 };
    cur.count++;
    cur.sum += m;
    byLevel.set(lvl, cur);
  }

  // Order: easiest → hardest → unspecified (so N5 reads first, top of
  // the list). The "未指定" group is vocab added without AI enrichment
  // (older entries or items where AI didn't classify).
  const order = ["N5", "N4", "N3", "N2", "N1", "未指定"];
  const result: MasteryByLevel[] = [];
  for (const lvl of order) {
    const stats = byLevel.get(lvl);
    if (stats && stats.count > 0) {
      result.push({
        level: lvl,
        count: stats.count,
        avg: Math.round(stats.sum / stats.count),
      });
    }
  }
  return result;
}

export async function getVocabByMastery(
  userId: string,
  order: "low" | "high",
  limit: number
): Promise<VocabWithMastery[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
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
    .order("mastery", { ascending: order === "low" })
    .limit(limit);

  if (error || !data) return [];

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
