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
  const reading = String(formData.get("reading") ?? "").trim();
  const meaning = String(formData.get("meaning") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim();
  const partOfSpeech = String(formData.get("part_of_speech") ?? "").trim();

  if (!word || !meaning) {
    const params = new URLSearchParams({ error: "missing" });
    if (word) params.set("word", word);
    if (reading) params.set("reading", reading);
    if (level) params.set("level", level);
    if (partOfSpeech) params.set("part_of_speech", partOfSpeech);
    if (type !== "word") params.set("type", type);
    redirect(`/vocabulary/new?${params.toString()}`);
  }

  const item = await createVocabularyItem({
    type,
    word,
    reading: reading || null,
    meaning,
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
