"use server";

// Bulk import vocabulary from a JSON batch into the current user's
// vocabulary_items + vocabulary_examples + vocabulary_tags +
// vocabulary_reviews tables.
//
// Designed for the JLPT N2-N1 sample (200 words) and reusable for
// future batches (Frank's full library will be 4000+ words). Uses
// Frank's existing OAuth session (auth.uid() = user.id), so RLS
// passes automatically — no service_role key needed.
//
// Triggered from app/admin/import-vocab/page.tsx:
//   - importPreloadedBatchAction(formData) — reads data/{batch}.json
//     where {batch} is from a hidden input. Whitelisted via
//     ./batches.ts so directory traversal is impossible.
//   - importPastedAction(formData) — parses textarea JSON
//
// Both actions share `processImport()` which:
//   1. SELECT existing words to dedup (skip-on-conflict)
//   2. Bulk INSERT vocabulary_items → returns ids
//   3. Bulk INSERT vocabulary_examples (1 per vocab, is_primary=true)
//   4. Bulk INSERT vocabulary_tags (1 per vocab, the category)
//   5. Bulk INSERT vocabulary_reviews (next_review_at=now, mastery=0)
//
// Total DB roundtrips: ~5 per batch (vs N×4 for per-item inserts).
// 200 words = ~5 queries; 4000 words = same 5 queries (chunked only
// if Supabase 1MB body limit is hit, ~2000 rows per chunk).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  PRELOADED_BATCH_SET,
  type PreloadedBatchFilename,
} from "./batches";
import {
  parseMd,
  validateBatch,
} from "@/lib/parse-jlpt-vocab-md.mjs";

// ---------- Types ----------
type ImportItem = {
  word: string;
  reading: string | null;
  meaning: string;
  level: string; // "N1" | "N2" — empty string if parser couldn't normalize
  category: string;
  example: {
    sentence: string;
    reading: string | null;
    translation: string | null;
  };
};

type ImportResult = {
  batch: string; // for the result banner
  inserted: number;
  skipped: number;
  failed: number;
  errors: Array<{ word: string; reason: string }>;
};

// ---------- Server Actions ----------

// importPreloadedBatchAction: read data/{batch}.json (where {batch}
// comes from the hidden form input). Whitelist guards directory
// traversal — anything not in PRELOADED_BATCH_SET is rejected before
// hitting the filesystem.
export async function importPreloadedBatchAction(formData: FormData) {
  const batch = String(formData.get("batch") ?? "").trim();
  // Per Frank #7045 (2026-08-27): I used `batch in PRELOADED_BATCH_SET`
  // — which is BROKEN. `in` checks object property keys, NOT Set
  // membership (a Set's own properties are `size` + prototype methods
  // like add/has/...; the items inside are NOT properties). Result:
  // every batch failed with "未识别" — including batch 1's button
  // (Frank only noticed when he tried batch 2).
  // Fix: use Set.has() which is the actual membership check.
  if (!PRELOADED_BATCH_SET.has(batch as PreloadedBatchFilename)) {
    redirect(
      `/admin/import-vocab?error=${encodeURIComponent(
        `未识别的批次文件: ${batch}（必须从预置白名单选）`
      )}`
    );
  }
  // TS narrowing — the in-check guarantees batch is in the set.
  const filename = batch as PreloadedBatchFilename;

  const items = await loadPreloaded(filename);
  if (items === null) {
    redirect(
      `/admin/import-vocab?error=${encodeURIComponent(
        `读取 data/${filename} 失败——文件可能 force-add 漏了`
      )}`
    );
  }

  const result = await processImport(items, filename);
  revalidatePath("/vocabulary");
  revalidatePath("/review");
  redirect(buildResultUrl(result));
}

export async function importPastedAction(formData: FormData) {
  const raw = String(formData.get("json") ?? "").trim();
  if (!raw) {
    redirect(`/admin/import-vocab?error=${encodeURIComponent("JSON 内容不能为空")}`);
  }

  let items: ImportItem[];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("expected JSON array, got " + typeof parsed);
    }
    items = parsed as ImportItem[];
  } catch (err) {
    redirect(`/admin/import-vocab?error=${encodeURIComponent(`JSON 解析失败：${String(err).slice(0, 200)}`)}`);
  }

  const result = await processImport(items, "<pasted>");
  revalidatePath("/vocabulary");
  revalidatePath("/review");
  redirect(buildResultUrl(result));
}

// Per Frank #7631 (2026-09-02): accept MD content directly via file
// upload OR textarea paste → parse server-side with the same parser
// the CLI script uses → call processImport. No intermediate JSON
// file needed. Pre-existing words (per current user) are deduped.
export async function importPastedMdAction(formData: FormData) {
  // Prefer file upload; fall back to textarea paste.
  const fileField = formData.get("mdFile");
  const pastedText = String(formData.get("md") ?? "").trim();

  let md = "";
  if (fileField instanceof File && fileField.size > 0) {
    md = await fileField.text();
  } else if (pastedText) {
    md = pastedText;
  } else {
    redirect(
      `/admin/import-vocab?error=${encodeURIComponent(
        "MD 内容为空 — 请上传 .md 文件或在文本框粘贴"
      )}`
    );
  }

  let items: ImportItem[];
  try {
    // validateBatch below will reject items without example.sentence,
    // so the null in the parser's intermediate state is safe to cast through.
    items = parseMd(md) as unknown as ImportItem[];
  } catch (err) {
    redirect(
      `/admin/import-vocab?error=${encodeURIComponent(
        `MD 解析失败: ${String(err).slice(0, 200)}`
      )}`
    );
  }

  const report = validateBatch(items);
  if (report.errors.length > 0) {
    const first = report.errors[0] as {
      at: string;
      msg: string;
      word?: string;
    };
    redirect(
      `/admin/import-vocab?error=${encodeURIComponent(
        `MD 校验失败 (${report.errors.length} 条): ${first.at} ${first.msg}${
          first.word ? ` ( ${first.word} )` : ""
        }`
      )}`
    );
  }

  const result = await processImport(items, "<md-paste>");
  revalidatePath("/vocabulary");
  revalidatePath("/review");
  redirect(buildResultUrl(result));
}

// ---------- Helpers ----------
async function loadPreloaded(
  filename: PreloadedBatchFilename
): Promise<ImportItem[] | null> {
  try {
    // process.cwd() on Vercel = repo root. The JSON is force-added to
    // git (data/ is gitignored but the preloaded JSONs are exceptions,
    // whitelisted in ./batches.ts).
    const abs = join(process.cwd(), "data", filename);
    const text = await readFile(abs, "utf-8");
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    return parsed as ImportItem[];
  } catch (err) {
    console.error(`loadPreloaded(${filename}) failed:`, err);
    return null;
  }
}

function buildResultUrl(r: ImportResult): string {
  const params = new URLSearchParams();
  if (r.batch) params.set("batch", r.batch);
  if (r.inserted > 0) params.set("inserted", String(r.inserted));
  if (r.skipped > 0) params.set("skipped", String(r.skipped));
  if (r.failed > 0) {
    params.set("failed", String(r.failed));
    if (r.errors.length > 0) {
      params.set(
        "firstError",
        r.errors[0].word + " — " + r.errors[0].reason.slice(0, 100)
      );
    }
  }
  return `/admin/import-vocab?${params.toString()}`;
}

// processImport: shared bulk-import logic.
async function processImport(
  items: ImportItem[],
  batch: string
): Promise<ImportResult> {
  const result: ImportResult = {
    batch,
    inserted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      ...result,
      failed: items.length,
      errors: [{ word: "<auth>", reason: "未登录" }],
    };
  }

  // ---------- 1. Filter items with required fields ----------
  const valid = items.filter((it) => {
    if (!it || typeof it !== "object") return false;
    return Boolean(it.word && it.meaning && it.example?.sentence);
  });
  if (valid.length === 0) {
    return { ...result, failed: items.length - valid.length };
  }

  // ---------- 2. Skip existing (word, reading) — user-scoped dedup ----------
  // Per Frank #7669 (2026-09-02 18:32): the previous SELECT returned
  // at most 1000 rows (Supabase default page size) — users with > 1000
  // words (Frank with batches 1-9 = 1800 words) hit "duplicate key
  // value violates unique constraint vocabulary_items_user_word_reading_unique"
  // because the dedup Set missed existing (word, reading) pairs.
  // Also: dedup key was just `word`, but the constraint is composite
  // (user_id, word, reading) — same word with different reading was
  // being over-skipped. Two partial unique indexes in 0005_chrome_extension.sql:
  //   (user_id, word, reading) WHERE reading IS NOT NULL
  //   (user_id, word)          WHERE reading IS NULL
  let allExisting: Array<{ word: string; reading: string | null }> = [];
  const PAGE_SIZE = 1000;
  for (let page = 0; ; page++) {
    const { data: pageData, error: pageErr } = await supabase
      .from("vocabulary_items")
      .select("word, reading")
      .eq("user_id", user.id)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (pageErr) {
      return {
        ...result,
        failed: valid.length,
        errors: [{ word: "<query>", reason: pageErr.message }],
      };
    }
    if (!pageData || pageData.length === 0) break;
    allExisting = allExisting.concat(pageData);
    if (pageData.length < PAGE_SIZE) break;
  }
  const seen = new Set<string>(
    allExisting.map((w) => `${w.word}::${w.reading ?? ""}`)
  );
  const toImport: ImportItem[] = [];
  for (const it of valid) {
    const key = `${it.word}::${it.reading ?? ""}`;
    if (seen.has(key)) {
      result.skipped++;
      continue;
    }
    seen.add(key);
    toImport.push(it);
  }
  if (toImport.length === 0) return result;

  // ---------- 3. Bulk INSERT vocabulary_items (returns ids) ----------
  const itemRows = toImport.map((it) => ({
    user_id: user.id,
    type: "word" as const,
    word: it.word,
    reading: it.reading || null,
    meaning: it.meaning,
    language: "ja",
    part_of_speech: null,
    level: it.level || null,
  }));

  const { data: insertedItems, error: itemErr } = await supabase
    .from("vocabulary_items")
    .insert(itemRows)
    .select("id, word, reading");

  if (itemErr || !insertedItems) {
    return {
      ...result,
      failed: toImport.length,
      errors: [
        {
          word: "<batch>",
          reason: itemErr?.message ?? "bulk insert returned no rows",
        },
      ],
    };
  }
  result.inserted = insertedItems.length;

  // Map: (word, reading) → id for the follow-up inserts. Composite key
  // matters when the batch contains two entries with the same word but
  // different readings — each must attach to its own vocabulary_id.
  const idByKey = new Map<string, string>();
  for (const row of insertedItems) {
    idByKey.set(`${row.word}::${row.reading ?? ""}`, row.id);
  }

  // ---------- 4. Bulk INSERT vocabulary_examples (1 per vocab) ----------
  const exampleRows = toImport
    .map((it) => {
      const id = idByKey.get(`${it.word}::${it.reading ?? ""}`);
      if (!id) return null;
      return {
        vocabulary_id: id,
        sentence: it.example.sentence,
        translation: it.example.translation || null,
        reading: it.example.reading || null,
        is_primary: true,
        generated_by_ai: false,
        user_edited: true,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (exampleRows.length > 0) {
    const { error: exErr } = await supabase
      .from("vocabulary_examples")
      .insert(exampleRows);
    if (exErr) {
      console.error("[import-vocab] bulk examples failed:", exErr);
      // Vocab created ok — examples are recoverable. Don't bump failed.
    }
  }

  // ---------- 5. Bulk INSERT vocabulary_tags (category per vocab) ----------
  const tagRows = toImport
    .filter(
      (it) => it.category && idByKey.has(`${it.word}::${it.reading ?? ""}`)
    )
    .map((it) => ({
      user_id: user.id,
      vocabulary_id: idByKey.get(`${it.word}::${it.reading ?? ""}`)!,
      tag: it.category,
    }));

  if (tagRows.length > 0) {
    const { error: tagErr } = await supabase
      .from("vocabulary_tags")
      .insert(tagRows);
    if (tagErr) {
      console.error("[import-vocab] bulk tags failed:", tagErr);
    }
  }

  // ---------- 6. Bulk INSERT vocabulary_reviews (one per vocab, due now) ----------
  // Per Frank #6348 + #6663: every new vocab needs a review row so it
  // shows up in /review. next_review_at=now → due immediately for
  // first-pass study. Skip if a row already exists (idempotent re-run).
  const reviewVocabIds = insertedItems.map((r) => r.id);
  const { data: existingReviews } = await supabase
    .from("vocabulary_reviews")
    .select("vocabulary_id")
    .eq("user_id", user.id)
    .in("vocabulary_id", reviewVocabIds);
  const existingReviewSet = new Set(
    (existingReviews ?? []).map((r) => r.vocabulary_id)
  );
  const reviewRows = insertedItems
    .filter((r) => !existingReviewSet.has(r.id))
    .map((r) => ({
      user_id: user.id,
      vocabulary_id: r.id,
      next_review_at: new Date().toISOString(),
      interval_days: 0,
      ease_factor: 2.5,
      mastery: 0,
    }));

  if (reviewRows.length > 0) {
    const { error: revErr } = await supabase
      .from("vocabulary_reviews")
      .insert(reviewRows);
    if (revErr) {
      console.error("[import-vocab] bulk reviews failed:", revErr);
    }
  }

  return result;
}