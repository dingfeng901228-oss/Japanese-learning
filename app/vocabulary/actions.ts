"use server";

// Server Actions for the vocabulary feature.
// Used by the manual-add form (app/vocabulary/new/page.tsx) and the
// delete button on the detail page (app/vocabulary/[id]/page.tsx).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createVocabularyItem,
  deleteVocabularyItem,
  getPrimaryExample,
  getVocabularyItem,
  type VocabularyType,
} from "@/lib/vocabulary";
import { generateExample } from "@/lib/vocabulary/examples";

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

  const item = await createVocabularyItem({
    type,
    word,
    reading: reading || null,
    // Pass undefined so createVocabularyItem triggers AI enrichment when blank.
    meaning: meaning || undefined,
    level: level || null,
    part_of_speech: partOfSpeech || null,
  });

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
