// Spaced-repetition scheduler (SM-2 simplified) + today's review queue.
//
// Phase 7 lands the SRS backbone:
//   - One vocabulary_reviews row per (user, vocabulary_items) created on
//     vocab add (next_review_at=now, ease_factor=2.5, interval_days=0).
//   - recordReview() updates the row using SM-2: easy/medium/hard +
//     incorrect all flow through the same quality score (q in [0,5]).
//   - getDueReviews() fetches items whose next_review_at <= now,
//     joined with the vocab word + the primary example sentence for
//     fill-in mode.
//
// Phase 8 (today's queue + fill-in mode) consumes getDueReviews() and
// surfaces one item at a time on /review. The fill-in UI is a separate
// Client Component (app/review/review-session.tsx).

import { createClient } from "@/lib/supabase/server";
import type { VocabularyType } from "@/lib/vocabulary";

export type ReviewItem = {
  id: string; // review row id
  vocabulary_id: string;
  word: string;
  reading: string | null;
  meaning: string;
  type: VocabularyType;
  example_sentence: string | null;
  example_reading: string | null;
  example_translation: string | null;
  interval_days: number;
  ease_factor: number;
  mastery: number;
  next_review_at: string | null;
};

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

function qualityFor(
  correct: boolean,
  difficulty: "easy" | "medium" | "hard"
): number {
  // SM-2 quality score (0-5). 0-2 = incorrect, 3-5 = correct with
  // varying confidence.
  if (!correct) return 2;
  if (difficulty === "easy") return 5;
  if (difficulty === "medium") return 4;
  return 3;
}

// Upsert a review row for the (user, vocabulary) pair. Idempotent: if a
// row already exists, leave its SRS state untouched (the user's progress
// is the source of truth). If not, create one with next_review_at=now
// so the new vocab is due immediately for first-pass study.
export async function ensureReviewRecord(vocabularyId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("vocabulary_reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("vocabulary_id", vocabularyId)
    .maybeSingle();

  if (existing) return;

  await supabase.from("vocabulary_reviews").insert({
    user_id: user.id,
    vocabulary_id: vocabularyId,
    next_review_at: new Date().toISOString(),
    interval_days: 0,
    ease_factor: DEFAULT_EASE,
    mastery: 0,
  });
}

export async function getDueReviews(limit = 20): Promise<ReviewItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const nowIso = new Date().toISOString();

  // Pull review rows whose next_review_at is null or in the past, joined
  // with the vocab word + the primary example (we want a sentence to
  // blank for fill-in mode).
  const { data, error } = await supabase
    .from("vocabulary_reviews")
    .select(
      `
      id,
      vocabulary_id,
      next_review_at,
      interval_days,
      ease_factor,
      mastery,
      vocabulary_items!inner ( word, reading, meaning, type ),
      vocabulary_examples ( sentence, reading, translation, is_primary )
    `
    )
    .eq("user_id", user.id)
    .or(`next_review_at.lte.${nowIso},next_review_at.is.null`)
    .order("next_review_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error("getDueReviews failed:", error);
    return [];
  }

  // Flatten + keep only items that have a primary example (otherwise
  // fill-in has nothing to show).
  const out: ReviewItem[] = [];
  for (const r of data ?? []) {
    const v = r.vocabulary_items as unknown as {
      word: string;
      reading: string | null;
      meaning: string;
      type: VocabularyType;
    };
    const examples = (r.vocabulary_examples ?? []) as Array<{
      sentence: string;
      reading: string | null;
      translation: string | null;
      is_primary: boolean;
    }>;
    const primary = examples.find((e) => e.is_primary) ?? examples[0];
    if (!primary) continue;

    out.push({
      id: r.id,
      vocabulary_id: r.vocabulary_id,
      word: v.word,
      reading: v.reading,
      meaning: v.meaning,
      type: v.type,
      example_sentence: primary.sentence,
      example_reading: primary.reading,
      example_translation: primary.translation,
      interval_days: r.interval_days,
      ease_factor: Number(r.ease_factor),
      mastery: r.mastery,
      next_review_at: r.next_review_at,
    });
  }
  return out;
}

export async function recordReview(
  reviewId: string,
  userAnswer: string,
  correct: boolean,
  difficulty: "easy" | "medium" | "hard"
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing, error: fetchErr } = await supabase
    .from("vocabulary_reviews")
    .select("interval_days, ease_factor, mastery")
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchErr || !existing) return;

  const q = qualityFor(correct, difficulty);
  let interval: number;
  let ease = Number(existing.ease_factor);

  if (q >= 3) {
    // Correct — interval grows.
    if (existing.interval_days === 0) interval = 1;
    else if (existing.interval_days === 1) interval = 6;
    else interval = Math.max(1, Math.round(existing.interval_days * ease));
    // SM-2 ease update formula. q=5 grows ease by +0.10, q=4 holds it,
    // q=3 drops it by -0.14. Floor at MIN_EASE so it never collapses.
    const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
    ease = Math.max(MIN_EASE, ease + delta);
  } else {
    // Incorrect — interval resets, ease drops a bit.
    interval = 1;
    ease = Math.max(MIN_EASE, ease - 0.2);
  }

  const reviewedAt = new Date();
  const nextReviewAt = new Date(reviewedAt.getTime() + interval * DAY_MS);

  // Mastery: simple step function. Correct bumps +10, incorrect drops -10,
  // clamped to [0, 100]. Drives the future mastery-bar UI in Phase 7+.
  const newMastery = correct
    ? Math.min(100, existing.mastery + 10)
    : Math.max(0, existing.mastery - 10);

  await supabase
    .from("vocabulary_reviews")
    .update({
      reviewed_at: reviewedAt.toISOString(),
      next_review_at: nextReviewAt.toISOString(),
      interval_days: interval,
      ease_factor: ease,
      mastery: newMastery,
      correct,
      user_answer: userAnswer,
      review_type: "fill-in",
    })
    .eq("id", reviewId);
}

// Per Frank #6348: vocabulary items created before ensureReviewRecord()
// was wired into createVocabularyItemAction never got a review row, so
// /review was permanently empty even for users with vocab. Backfill
// inserts review rows for every (user, vocabulary) pair that's missing
// one — idempotent (skips existing ids). Items without a primary
// example stay queued but getDueReviews filters them out, so they
// don't appear in /review until they get an example.
export async function backfillUserReviews(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // 1) All vocab ids the user owns.
  const { data: vocabItems, error: vErr } = await supabase
    .from("vocabulary_items")
    .select("id")
    .eq("user_id", user.id);
  if (vErr || !vocabItems || vocabItems.length === 0) return 0;

  // 2) Ids that already have a review record (don't overwrite progress).
  const { data: existing } = await supabase
    .from("vocabulary_reviews")
    .select("vocabulary_id")
    .eq("user_id", user.id);
  const existingSet = new Set(
    (existing ?? []).map((r) => r.vocabulary_id)
  );

  // 3) Build the missing insert list.
  const toInsert = vocabItems
    .filter((v) => !existingSet.has(v.id))
    .map((v) => ({
      user_id: user.id,
      vocabulary_id: v.id,
      next_review_at: new Date().toISOString(),
      interval_days: 0,
      ease_factor: DEFAULT_EASE,
      mastery: 0,
    }));

  if (toInsert.length === 0) return 0;

  // 4) Bulk insert. Supabase returns per-row errors; log but don't throw.
  const { error: insErr } = await supabase
    .from("vocabulary_reviews")
    .insert(toInsert);
  if (insErr) {
    console.error("backfillUserReviews insert failed:", insErr);
    return 0;
  }
  return toInsert.length;
}

// Cheap count query for /review empty-state branching — distinguishes
// "user has no vocab at all" from "user has vocab but queue is empty
// (needs backfill)". select on (id, head:true, count:'exact') avoids
// shipping the rows.
export async function getUserVocabCount(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (error) return 0;
  return count ?? 0;
}
