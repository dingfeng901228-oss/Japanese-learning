"use server";

// Server Action for the fill-in review session (Phase 8). Reads the
// review id + answer + correct + difficulty from FormData and routes
// them through lib/vocabulary/reviews.ts recordReview(), which runs
// the SM-2 algorithm and updates next_review_at / interval / ease /
// mastery in Supabase.

import { revalidatePath } from "next/cache";
import { recordReview } from "@/lib/vocabulary/reviews";

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
