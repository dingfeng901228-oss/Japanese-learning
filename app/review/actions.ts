"use server";

// Server Action for the fill-in review session (Phase 8). Reads the
// review id + answer + correct + difficulty from FormData and routes
// them through lib/vocabulary/reviews.ts recordReview(), which runs
// the SM-2 algorithm and updates next_review_at / interval / ease /
// mastery in Supabase.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  recordReview,
  backfillUserReviews,
} from "@/lib/vocabulary/reviews";

export async function recordReviewAction(formData: FormData) {
  const reviewId = String(formData.get("review_id") ?? "").trim();
  const answer = String(formData.get("answer") ?? "");
  const correct = formData.get("correct") === "1";
  const difficultyRaw = String(formData.get("difficulty") ?? "medium");
  const difficulty: "easy" | "medium" | "hard" =
    difficultyRaw === "easy" || difficultyRaw === "hard"
      ? difficultyRaw
      : "medium";

  if (!reviewId) return;

  await recordReview(reviewId, answer, correct, difficulty);
  revalidatePath("/review");
}

// Per Frank #6348: one-shot backfill so users whose vocabulary predates
// the ensureReviewRecord hook (in createVocabularyItemAction) get their
// words into the SRS queue. Triggered by the "把已收藏的词加入复习队列"
// button on /review's empty state (only shown when dueItems is empty
// but vocabCount > 0).
//
// Per Frank #6351: surface the "user has vocab but no item has an
// example attached yet" case as a dedicated ?notice=no_examples query
// so the page UI can explain what's missing instead of silently
// reloading to the same empty state.
export async function backfillUserReviewsAction() {
  const result = await backfillUserReviews();

  if (result.totalVocab > 0 && result.eligible === 0) {
    redirect("/review?notice=no_examples");
  }

  revalidatePath("/review");
  redirect("/review");
}
