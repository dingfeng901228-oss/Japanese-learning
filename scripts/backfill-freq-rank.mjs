/**
 * backfill-freq-rank.mjs — fill vocabulary_items.freq_rank for words that
 * were added before the dictionary lookup existed.
 *
 * Why: the 「按常用度」 sort and the 常用/次常用/少用 badge read
 * freq_rank. Words saved before the lookup widget (or words that
 * weren't in the dictionary index) have no rank, so they'd all sort
 * last and show no badge. This script backfills them from
 * public/dict/lookup.json (JMdict-derived, see
 * public/dict/ATTRIBUTION.md).
 *
 * Usage:
 *   node scripts/backfill-freq-rank.mjs                 # dry run
 *   node scripts/backfill-freq-rank.mjs --apply         # write to the DB
 *
 * Requires the service-role key — the anon key can't read your rows
 * because vocabulary_items has an RLS policy scoped to auth.uid():
 *
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * On PowerShell:
 *   $env:NEXT_PUBLIC_SUPABASE_URL='https://xxx.supabase.co'
 *   $env:SUPABASE_SERVICE_ROLE_KEY='eyJ...'
 *
 * Run the migration first:
 *   supabase/migrations/0008_vocab_freq_rank.sql
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const APPLY = process.argv.includes("--apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and\n" +
      "SUPABASE_SERVICE_ROLE_KEY (the service-role key — the anon key\n" +
      "can't read your rows, RLS scopes them to the signed-in user).\n" +
      "On PowerShell:\n" +
      "  $env:NEXT_PUBLIC_SUPABASE_URL='https://xxx.supabase.co'\n" +
      "  $env:SUPABASE_SERVICE_ROLE_KEY='eyJ...'\n"
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

/** word -> JMdict frequency rank (lower = more common) */
async function loadFreqMap() {
  const raw = await readFile(
    join(ROOT, "public", "dict", "lookup.json"),
    "utf8"
  );
  const lookup = JSON.parse(raw);
  const map = new Map();
  for (const [word, entry] of Object.entries(lookup)) {
    if (entry && typeof entry.f === "number" && entry.f > 0) {
      map.set(word, entry.f);
    }
  }
  return map;
}

async function main() {
  console.log("Loading public/dict/lookup.json …");
  const freq = await loadFreqMap();
  console.log(`  ${freq.size} words with a frequency rank`);

  const { data: items, error } = await supabase
    .from("vocabulary_items")
    .select("id, word, freq_rank");
  if (error) {
    console.error("Failed to read vocabulary_items:", error.message);
    if (/freq_rank|column .* does not exist/i.test(error.message ?? "")) {
      console.error(
        "\n→ The freq_rank column doesn't exist yet. Apply the migration first:\n" +
          "  supabase/migrations/0008_vocab_freq_rank.sql"
      );
    }
    process.exit(1);
  }

  const rows = items ?? [];
  console.log(`\n${rows.length} vocabulary items in the database.`);

  const toUpdate = [];
  let alreadySet = 0;
  let notInDict = 0;

  for (const item of rows) {
    if (item.freq_rank != null) {
      alreadySet++;
      continue;
    }
    const rank = freq.get(item.word);
    if (rank == null) {
      notInDict++;
      continue;
    }
    toUpdate.push({ id: item.id, word: item.word, rank });
  }

  console.log(`  already have a rank : ${alreadySet}`);
  console.log(`  missing, in dict    : ${toUpdate.length}`);
  console.log(`  missing, not in dict: ${notInDict}`);

  if (toUpdate.length === 0) {
    console.log("\nNothing to backfill.");
    return;
  }

  if (!APPLY) {
    console.log("\nDry run — first 20 that would be updated:");
    for (const u of toUpdate.slice(0, 20)) {
      console.log(`  ${u.word.padEnd(14)} → rank ${u.rank}`);
    }
    console.log(
      `\nRe-run with --apply to write ${toUpdate.length} rows to the database.`
    );
    return;
  }

  console.log(`\nApplying ${toUpdate.length} updates …`);
  let ok = 0;
  let failed = 0;
  // Per-row UPDATE, not upsert: upsert would try to insert a new row
  // (and user_id is NOT NULL, so that would fail). Concurrent in small
  // batches so we don't hammer the API.
  const BATCH = 20;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const chunk = toUpdate.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map(async (c) => {
        const { error: upErr } = await supabase
          .from("vocabulary_items")
          .update({ freq_rank: c.rank })
          .eq("id", c.id);
        return upErr ? { c, upErr } : null;
      })
    );
    for (const r of results) {
      if (r) {
        failed++;
        console.error(`  ${r.c.word}: ${r.upErr.message}`);
      } else {
        ok++;
      }
    }
    process.stdout.write(
      `\r  ${ok + failed} / ${toUpdate.length} processed`
    );
  }
  process.stdout.write("\n");
  console.log(`Done. ${ok} updated, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
