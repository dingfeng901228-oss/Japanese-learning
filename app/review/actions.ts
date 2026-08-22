"use server";

// Server Action for the new single recall flow (per docs/review.docx,
// Frank #6663 redesign). Reads `review_id` + `outcome` ("remembered"
// or "again") from FormData and routes through
// lib/vocabulary/reviews.ts recordReview(), which runs the SM-2
// algorithm (quality=5 on remembered, quality=2 on again) and updates
// next_review_at / interval / ease / mastery in Supabase.
//
// Dropped: `answer`, `correct`, `difficulty` fields — the new flow has
// no text input and only two outcomes (binary), no middle ground.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  recordReview,
  backfillUserReviews,
} from "@/lib/vocabulary/reviews";

export async function recordReviewAction(formData: FormData) {
  const reviewId = String(formData.get("review_id") ?? "").trim();
  const outcomeRaw = String(formData.get("outcome") ?? "");
  // Strict whitelist — any unexpected value falls back to "again" so a
  // bug or tampered FormData can't accidentally pass `remembered` and
  // bump a review interval the user never explicitly approved.
  const outcome: "remembered" | "again" =
    outcomeRaw === "remembered" || outcomeRaw === "again"
      ? outcomeRaw
      : "again";

  if (!reviewId) return;

  await recordReview(reviewId, outcome);
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
