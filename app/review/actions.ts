"use server";

// Server Action for the recall flow. Reads `review_id` + `outcome` from
// FormData and routes through lib/vocabulary/reviews.ts recordReview(),
// which applies the four-grade schedule in lib/vocabulary/srs.ts and
// updates next_review_at / interval / ease / mastery / last_grade.
//
// Audit 2026-11-16 P1-6: the grades are now four — 忘了 (again) /
// 模糊 (hard) / 记得 (good) / 熟练 (easy) — instead of the old binary
// 再来一次 / 记住了, so a word can be scheduled at four different
// intervals instead of two.
//
// Dropped: `answer`, `correct`, `difficulty` fields — the flow has no
// text input.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  recordReview,
  backfillUserReviews,
} from "@/lib/vocabulary/reviews";
import type { GradeId } from "@/lib/vocabulary/srs";

export async function recordReviewAction(formData: FormData) {
  const reviewId = String(formData.get("review_id") ?? "").trim();
  const outcomeRaw = String(formData.get("outcome") ?? "");
  // Strict whitelist — any unexpected value falls back to "again" so a
  // bug or tampered FormData can't accidentally pass `remembered` and
  // bump a review interval the user never explicitly approved.
  const outcome: GradeId =
    outcomeRaw === "again" ||
    outcomeRaw === "hard" ||
    outcomeRaw === "good" ||
    outcomeRaw === "easy"
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
