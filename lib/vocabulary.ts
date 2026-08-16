// Server-side data access for vocabulary_items.
// Used by Server Components + Server Actions in app/vocabulary/.
//
// All queries rely on the Supabase session cookie (via lib/supabase/server.ts)
// and the RLS policies in supabase/migrations/0003_vocabulary.sql —
// the user_id filter on `eq` is redundant with RLS but kept for clarity.

import { createClient } from "@/lib/supabase/server";

export type VocabularyType = "word" | "phrase" | "grammar" | "sentence";

export type VocabularyItem = {
  id: string;
  user_id: string;
  type: VocabularyType;
  word: string;
  reading: string | null;
  meaning: string;
  language: string;
  part_of_speech: string | null;
  level: string | null;
  mastery: number;
  created_at: string;
  updated_at: string;
};

export type NewVocabularyItem = {
  type: VocabularyType;
  word: string;
  reading?: string | null;
  meaning: string;
  language?: string;
  part_of_speech?: string | null;
  level?: string | null;
};

export type VocabularySort = "newest" | "oldest" | "word";

export type ListVocabularyOpts = {
  type?: VocabularyType;
  search?: string;
  sort?: VocabularySort;
};

// Wrap supabase errors so callers can throw without leaking SDK details.
function ensureData<T>(res: { data: T | null; error: { message: string } | null }, fallback: T): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? fallback) as T;
}

export async function listVocabularyItems(
  opts: ListVocabularyOpts = {}
): Promise<VocabularyItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("vocabulary_items")
    .select("*")
    .eq("user_id", user.id);

  if (opts.type) {
    query = query.eq("type", opts.type);
  }

  const q = opts.search?.trim();
  if (q) {
    // Escape single quotes for the .or() filter to avoid breaking PostgREST.
    const safe = q.replace(/'/g, "''");
    query = query.or(
      `word.ilike.%${safe}%,reading.ilike.%${safe}%,meaning.ilike.%${safe}%`
    );
  }

  if (opts.sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (opts.sort === "word") {
    query = query.order("word", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  return ensureData(await query, [] as VocabularyItem[]);
}

export async function getVocabularyItem(
  id: string
): Promise<VocabularyItem | null> {
  const supabase = await createClient();
  return ensureData(
    await supabase
      .from("vocabulary_items")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    null
  );
}

export async function createVocabularyItem(
  item: NewVocabularyItem
): Promise<VocabularyItem> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  return ensureData(
    await supabase
      .from("vocabulary_items")
      .insert({
        user_id: user.id,
        type: item.type,
        word: item.word,
        reading: item.reading ?? null,
        meaning: item.meaning,
        language: item.language ?? "ja",
        part_of_speech: item.part_of_speech ?? null,
        level: item.level ?? null,
      })
      .select()
      .single(),
    null as unknown as VocabularyItem
  );
}

export async function deleteVocabularyItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vocabulary_items")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function countVocabularyItems(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
