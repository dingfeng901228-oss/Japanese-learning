"use server";

// Server Actions for the vocabulary feature.
// Used by the manual-add form (app/vocabulary/new/page.tsx) and the
// delete / edit / regenerate-example buttons on the detail page
// (app/vocabulary/[id]/page.tsx).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createVocabularyItem,
  deleteVocabularyItem,
  getPrimaryExample,
  getVocabLearningState,
  getVocabularyItem,
  recordVocabLearningTime,
  type VocabLearningState,
  type VocabularyType,
} from "@/lib/vocabulary";
import { generateExample } from "@/lib/vocabulary/examples";
import { ensureReviewRecord } from "@/lib/vocabulary/reviews";
import {
  getUserLearningState as getUserLearningStateHelper,
  startLearningSession as startLearningSessionHelper,
  setDailyLearningStatus as setDailyLearningStatusHelper,
  type LearningState,
  type LearningFilterContext,
  type StartLearningSessionResult,
} from "@/lib/vocabulary/learn";

const JLPT_LEVELS = new Set(["N5", "N4", "N3", "N2", "N1"]);
function normalizeLevel(raw: string): string {
  return JLPT_LEVELS.has(raw) ? raw : "";
}

function parseType(raw: FormDataEntryValue | null): VocabularyType {
  const v = String(raw ?? "word");
  if (v === "phrase" || v === "grammar" || v === "sentence") return v;
  return "word";
}

export async function createVocabularyItemAction(formData: FormData) {
  const type = parseType(formData.get("type"));
  const word = String(formData.get("word") ?? "").trim();

  if (!word) {
    redirect("/vocabulary/new?error=missing_word");
  }

  // Optional fields — user can override, but AI fills in if blank.
  const reading = String(formData.get("reading") ?? "").trim();
  const meaning = String(formData.get("meaning") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim();
  const partOfSpeech = String(formData.get("part_of_speech") ?? "").trim();

  // Per Frank #7094 (2026-08-27): the whole flow used to be
  // uncaught — if createVocabularyItem threw (e.g., Supabase insert
  // failed), Next.js surfaced a generic "Application error: server-side
  // exception" with Digest N (in Frank's case Digest: 3269631591).
  // That tells the user nothing actionable. Wrap each step so any
  // failure degrades gracefully to a user-visible error page instead
  // of bubbling all the way to Next.js's 500 handler.
  let item;
  try {
    item = await createVocabularyItem({
      type,
      word,
      reading: reading || null,
      // Pass undefined so createVocabularyItem triggers AI enrichment when blank.
      meaning: meaning || undefined,
      level: level || null,
      part_of_speech: partOfSpeech || null,
    });
  } catch (err) {
    // Per Frank #7103 (2026-08-28): distinguish user-fixable errors
    // (duplicate word) from transient server failures.
    //
    // 23505 = PG unique_violation. 0005_chrome_extension.sql:83-87 adds
    // partial unique indexes on (user_id, word[, reading]), so 收藏 a
    // word already in the user's collection hits this branch. It's a
    // user input issue (not a server problem), so "稍后重试 / 联系管理员"
    // is misleading. ensureData preserves `code` on the thrown Error so
    // we can branch on it here.
    if ((err as { code?: string }).code === "23505") {
      redirect("/vocabulary/new?error=duplicate");
    }
    // Log the full error so Vercel server logs (searchable by Digest
    // or word) give the next maintainer a real stack trace to debug.
    // We don't know the root cause without Vercel access; this is the
    // best signal we can leave.
    console.error("createVocabularyItemAction: createVocabularyItem failed", {
      word,
      type,
      errMessage: err instanceof Error ? err.message : String(err),
      errStack: err instanceof Error ? err.stack : undefined,
    });
    redirect("/vocabulary/new?error=create_failed");
  }

  // Per Frank #6348: hook up the SRS queue. Without this, the new
  // vocab never lands in vocabulary_reviews and /review stays empty
  // for the user until they manually trigger a backfill.
  //
  // Also wrapped (2026-08-27 #7094): if this second call throws, the
  // vocab IS created — failing here would lose the user's work AND
  // surface a generic Application Error. Wrap and continue, the SRS
  // queue can be backfilled later from /review's empty state.
  try {
    await ensureReviewRecord(item.id);
  } catch (err) {
    console.error("createVocabularyItemAction: ensureReviewRecord failed", {
      vocabularyId: item.id,
      word,
      errMessage: err instanceof Error ? err.message : String(err),
    });
  }

  revalidatePath("/vocabulary");
  redirect(`/vocabulary/${item.id}`);
}

export async function deleteVocabularyItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/vocabulary");
  await deleteVocabularyItem(id);
  revalidatePath("/vocabulary");
  redirect("/vocabulary");
}

// Phase 1.7: edit the word itself (headword / reading / meaning /
// JLPT level / part of speech) on the detail page. Triggered by the
// "编辑" link next to the 🔊 button on the top card. Uses a separate
// query param (?edit_word=1) so it doesn't collide with the existing
// example editor (?edit=1).
export async function updateWordAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const word = String(formData.get("word") ?? "").trim();
  const reading = String(formData.get("reading") ?? "").trim();
  const meaning = String(formData.get("meaning") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "").trim();
  const partOfSpeech = String(formData.get("part_of_speech") ?? "").trim();

  if (!id) redirect("/vocabulary");
  // word + meaning are required (meaning is NOT NULL in the schema).
  if (!word || !meaning) redirect(`/vocabulary/${id}?edit_word=1`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("vocabulary_items")
    .update({
      word,
      reading: reading || null,
      meaning,
      level: normalizeLevel(levelRaw) || null,
      part_of_speech: partOfSpeech || null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("updateWordAction: update failed", error);
    redirect(`/vocabulary/${id}?edit_word=1`);
  }

  revalidatePath(`/vocabulary/${id}`);
  // Also revalidate /vocabulary list since the headword may have changed.
  revalidatePath("/vocabulary");
  redirect(`/vocabulary/${id}`);
}

export async function regenerateExampleAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/vocabulary");

  const item = await getVocabularyItem(id);
  if (!item) redirect("/vocabulary");

  // Generate a new example. If AI fails or returns nothing, redirect
  // back without changing anything (user can retry).
  let generated;
  try {
    generated = await generateExample({
      word: item.word,
      meaning: item.meaning,
      reading: item.reading,
      type: item.type,
    });
  } catch (err) {
    console.error("regenerateExampleAction: AI failed", err);
    redirect(`/vocabulary/${id}`);
  }
  if (!generated.sentence) redirect(`/vocabulary/${id}`);

  const supabase = await (await import("@/lib/supabase/server")).createClient();

  // Partial unique index on (vocabulary_id) WHERE is_primary: at most
  // one primary per vocab. Either UPDATE the existing primary or INSERT.
  const existing = await getPrimaryExample(id);
  if (existing) {
    const { error } = await supabase
      .from("vocabulary_examples")
      .update({
        sentence: generated.sentence,
        translation: generated.translation,
        reading: generated.reading,
        generated_by_ai: true,
        user_edited: false,
      })
      .eq("id", existing.id);
    if (error) {
      console.error("regenerateExampleAction: update failed", error);
      redirect(`/vocabulary/${id}`);
    }
  } else {
    const { error } = await supabase.from("vocabulary_examples").insert({
      vocabulary_id: id,
      sentence: generated.sentence,
      translation: generated.translation,
      reading: generated.reading,
      is_primary: true,
      generated_by_ai: true,
    });
    if (error) {
      console.error("regenerateExampleAction: insert failed", error);
      redirect(`/vocabulary/${id}`);
    }
  }

  revalidatePath(`/vocabulary/${id}`);
  redirect(`/vocabulary/${id}`);
}

export async function updateExampleAction(formData: FormData) {
  const vocabularyId = String(formData.get("vocabulary_id") ?? "").trim();
  const sentence = String(formData.get("sentence") ?? "").trim();
  const reading = String(formData.get("reading") ?? "").trim();
  const translation = String(formData.get("translation") ?? "").trim();

  if (!vocabularyId) redirect("/vocabulary");
  // Sentence is the only required field — the others can be empty.
  if (!sentence) redirect(`/vocabulary/${vocabularyId}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const existing = await getPrimaryExample(vocabularyId);
  if (existing) {
    const { error } = await supabase
      .from("vocabulary_examples")
      .update({
        sentence,
        reading: reading || null,
        translation: translation || null,
        user_edited: true,
        generated_by_ai: false,
      })
      .eq("id", existing.id);
    if (error) {
      console.error("updateExampleAction: update failed", error);
      redirect(`/vocabulary/${vocabularyId}?edit=1`);
    }
  } else {
    const { error } = await supabase.from("vocabulary_examples").insert({
      vocabulary_id: vocabularyId,
      sentence,
      reading: reading || null,
      translation: translation || null,
      is_primary: true,
      generated_by_ai: false,
      user_edited: true,
    });
    if (error) {
      console.error("updateExampleAction: insert failed", error);
      redirect(`/vocabulary/${vocabularyId}?edit=1`);
    }
  }

  revalidatePath(`/vocabulary/${vocabularyId}`);
  redirect(`/vocabulary/${vocabularyId}`);
}

// ==========================================================================
// Per-vocab learning time tracking per docs/0830需求.md
// (Frank #7274 / #7276, 2026-08-30).
//
// Wraps the typed helpers in lib/vocabulary.ts. The atomic increment
// + 5000ms cap + daily-reset branch lives in migration 0006's
// `increment_vocab_learning_time` RPC — these actions are thin
// pass-throughs so the client hook can use the standard Next.js
// server-action wiring (no manual POST to /api/* for the normal
// flush path; sendBeacon handles tab-close separately).
//
// No revalidatePath: the hook is reactive, the page is not affected
// by which "today's" counter is in flight.
// ==========================================================================

export async function getVocabLearningStateAction(
  vocabId: string,
  todayDate: string
): Promise<VocabLearningState> {
  return await getVocabLearningState(vocabId, todayDate);
}

export async function recordVocabLearningTimeAction(
  vocabId: string,
  deltaMs: number,
  todayDate: string
): Promise<{ learningTimeMs: number; state: "IDLE" | "COMPLETED" }> {
  return await recordVocabLearningTime(vocabId, deltaMs, todayDate);
}

// ==========================================================================
// Formal learning session (docs/vocabuly0831.md, Frank #7397, 2026-08-31).
//
// Per Q1-(b): /vocabulary/learn is the dedicated "formal learning"
// surface. Entering it increments vocabulary_items.learning_count via
// the start_learning_session RPC. /vocabulary/[id] (detail page) does
// NOT touch learning_count — viewing a vocab is not "learning" it.
//
// All three actions are thin pass-throughs to lib/vocabulary/learn.ts
// (the typed wrappers around the 0007 RPCs). The page-level + client
// components call these from server actions and useTransition /
// router.push; no manual POST to /api/* needed.
//
// No revalidatePath on startLearningSession: the next mount of
// LearnSession picks up the fresh learningCount via the action's
// return value, and the list page re-fetches getUserLearningState on
// its own server render.
// ==========================================================================

export async function getUserLearningStateAction(): Promise<LearningState> {
  return await getUserLearningStateHelper();
}

export async function startLearningSessionAction(
  opts: StartLearningSessionActionOpts,
): Promise<StartLearningSessionResult> {
  return await startLearningSessionHelper(opts);
}

export async function setDailyLearningStatusAction(
  status: "active" | "completed",
): Promise<void> {
  return await setDailyLearningStatusHelper(status);
}

export type StartLearningSessionActionOpts = {
  vocabId: string;
  sessionToken: string;
  filterContext?: LearningFilterContext;
};
