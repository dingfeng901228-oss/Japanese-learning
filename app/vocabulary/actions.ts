"use server";

// Server Actions for the vocabulary feature.
// Used by the manual-add form (app/vocabulary/new/page.tsx) and the
// delete button on the detail page (app/vocabulary/[id]/page.tsx).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createVocabularyItem,
  deleteVocabularyItem,
  type VocabularyType,
} from "@/lib/vocabulary";

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
