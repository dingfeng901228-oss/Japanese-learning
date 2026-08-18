"use server";

// Server Actions for the speaking page.
//
// Phase 1 enhancement (错误记忆): saveMistakeToVocabAction takes a
// word from the AI tutor's vocabulary feedback and creates a vocab
// item via lib/vocabulary.ts `createVocabularyItem`. That function
// already:
//   - auto-fills reading/meaning/JLPT/part_of_speech via gpt-4o-mini
//     (lib/vocabulary/enrich.ts) when missing
//   - auto-generates a primary example via gpt-4o-mini
//     (lib/vocabulary/examples.ts)
//   - queues it for first-pass review (lib/vocabulary/reviews.ts,
//     next_review_at=now)
//
// So a single click on the button kicks off the full vocab pipeline —
// 2-3 gpt-4o-mini calls, ~2-6 seconds, ~$0.002 — and the new word
// shows up on /vocabulary and /review.

import { revalidatePath } from "next/cache";
import { createVocabularyItem, type VocabularyType } from "@/lib/vocabulary";

export async function saveMistakeToVocabAction(formData: FormData) {
  const word = String(formData.get("word") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "word");
  const type: VocabularyType =
    typeRaw === "phrase" ||
    typeRaw === "grammar" ||
    typeRaw === "sentence"
      ? typeRaw
      : "word";

  if (!word) return;

  try {
    await createVocabularyItem({
      type,
      word,
      // All other fields are auto-filled by AI; see createVocabularyItem.
    });
    revalidatePath("/vocabulary");
    // No redirect — the speaking page should stay where it is; the
    // button optimistically shows "✓ 已保存" via the client state.
  } catch (err) {
    console.error("saveMistakeToVocabAction failed:", err);
  }
}
