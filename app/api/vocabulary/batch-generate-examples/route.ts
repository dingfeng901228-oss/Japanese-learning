// POST /api/vocabulary/batch-generate-examples
//
// Per Frank #6367: bulk-generate examples for every vocab that doesn't
// have a primary example yet. Lives at an API route (not a "use server"
// action) because Vercel's Next.js build rejects non-function exports
// from "use server" files — and we need `maxDuration` to extend the
// default timeout (10s Hobby / 15s Pro) past the ~44s 22-vocab run.
//
// Flow:
//   1. Authenticate user via Supabase server client.
//   2. Fetch all user's vocab items.
//   3. Fetch existing primary example vocab_ids in one query (no N+1).
//   4. For each vocab without a primary, call generateExample() +
//      insert as primary example.
//   5. revalidate /vocabulary + /review, redirect to summary banner.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateExample } from "@/lib/vocabulary/examples";

// Hobby default is 10s; Pro default 15s. Bump to 60s (Hobby max).
// 22 vocab × ~2s ≈ 44s leaves headroom for slow OpenAI calls.
// On Pro, maxDuration caps at 300s; on Hobby, this is the ceiling.
export const maxDuration = 60;

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", _request.url),
      { status: 303 }
    );
  }

  // 1) Fetch user's vocab items.
  const { data: vocabItems, error: vErr } = await supabase
    .from("vocabulary_items")
    .select("id, word, meaning, reading, type")
    .eq("user_id", user.id);

  if (vErr || !vocabItems) {
    console.error(
      "batch-generate-examples: vocab fetch failed",
      vErr
    );
    return NextResponse.redirect(
      new URL("/vocabulary?batch=0-0-error", _request.url),
      { status: 303 }
    );
  }

  if (vocabItems.length === 0) {
    return NextResponse.redirect(
      new URL("/vocabulary?batch=0-0-empty", _request.url),
      { status: 303 }
    );
  }

  // 2) Single query for all vocab ids that already have a primary
  //    example — avoids N+1 round-trips.
  const vocabIds = vocabItems.map((v) => v.id);
  const { data: existingPrimaries } = await supabase
    .from("vocabulary_examples")
    .select("vocabulary_id")
    .eq("is_primary", true)
    .in("vocabulary_id", vocabIds);
  const primarySet = new Set(
    (existingPrimaries ?? []).map((e) => e.vocabulary_id)
  );

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  // 3) For each vocab without primary, generate + insert.
  for (const item of vocabItems) {
    if (primarySet.has(item.id)) {
      skipped++;
      continue;
    }

    try {
      const ex = await generateExample({
        word: item.word,
        meaning: item.meaning,
        reading: item.reading,
        type: item.type,
      });

      if (!ex.sentence) {
        errors++;
        continue;
      }

      const { error: insErr } = await supabase
        .from("vocabulary_examples")
        .insert({
          vocabulary_id: item.id,
          sentence: ex.sentence,
          translation: ex.translation,
          reading: ex.reading,
          is_primary: true,
          generated_by_ai: true,
        });

      if (insErr) {
        console.error(
          "batch-generate-examples: insert failed",
          insErr
        );
        errors++;
      } else {
        generated++;
      }
    } catch (err) {
      console.error(
        "batch-generate-examples: generate failed for",
        item.word,
        err
      );
      errors++;
    }
  }

  revalidatePath("/vocabulary");
  revalidatePath("/review");

  // Status passed back via redirect query: `batch=G-S-E` means
  // `generated=G skipped=S errors=E`. The /vocabulary page parses this
  // and shows a summary banner.
  return NextResponse.redirect(
    new URL(
      `/vocabulary?batch=${generated}-${skipped}-${errors}`,
      _request.url
    ),
    { status: 303 }
  );
}
