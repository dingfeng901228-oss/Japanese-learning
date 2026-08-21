// POST /api/vocabulary
//
// Chrome extension endpoint for saving Japanese vocabulary items from
// any webpage. Per docs/0821requirements.docx §8-§16, §25-§26.
//
// Auth: Authorization: Bearer <extensionToken> — SHA-256 hash looked up
// in extension_tokens. Updates last_used_at on success.
//
// Response shape (per 需求 §12, §26):
//   201: { success: true, duplicate: false, data: { id, word, reading, meaningZh } }
//   200: { success: true, duplicate: true, message: "已经收藏过了", data: { ... } }
//   401: { success: false, error: "invalid_token" | "missing_bearer" }
//   403: { success: false, error: "token_revoked" }
//   422: { success: false, error: "invalid_input", details: {...} }
//   429: { success: false, error: "rate_limited" }
//   500: { success: false, error: "internal" }
//
// Validation (per 需求 §25):
//   word: 1-200 chars
//   source: 1-64 chars (required, e.g. "chrome-extension")
//   sourceUrl: 1-2048 chars
//   sourceTitle: 0-500 chars
//   sourceDomain: 0-253 chars (RFC 1034 hostname max)
//   sourceFavicon: 0-2048 chars
//
// Auth uses the service-role client (lib/supabase/admin.ts) because the
// Chrome extension has no Supabase session cookies — it authenticates
// purely via the Bearer token. The admin client bypasses RLS, but every
// query is scoped by `user_id` we looked up from the token hash, so the
// security model is the same as RLS would enforce.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, sha256Hex } from "@/lib/supabase/admin";
import { enrichVocabulary } from "@/lib/vocabulary/enrich";
import { ensureReviewRecord } from "@/lib/vocabulary/reviews";
import { generateExample } from "@/lib/vocabulary/examples";

const MAX_WORD = 200;
const MAX_SOURCE = 64;
const MAX_SOURCE_URL = 2048;
const MAX_SOURCE_TITLE = 500;
const MAX_SOURCE_DOMAIN = 253;
const MAX_SOURCE_FAVICON = 2048;
const RATE_LIMIT_PER_MIN = 60;

interface PostBody {
  word?: unknown;
  source?: unknown;
  sourceUrl?: unknown;
  sourceTitle?: unknown;
  sourceDomain?: unknown;
  sourceFavicon?: unknown;
}

function errJson(
  error: string,
  status: number,
  details?: string,
): NextResponse {
  return NextResponse.json(
    { success: false, error, ...(details ? { details } : {}) },
    { status },
  );
}

function asString(
  v: unknown,
  max: number,
  required: boolean,
  field: string,
): { ok: true; value: string } | { ok: false; err: string } {
  if (v === undefined || v === null) {
    return required
      ? { ok: false, err: `${field} is required` }
      : { ok: true, value: "" };
  }
  if (typeof v !== "string") {
    return { ok: false, err: `${field} must be a string` };
  }
  if (required && v.length === 0) {
    return { ok: false, err: `${field} must not be empty` };
  }
  if (v.length > max) {
    return { ok: false, err: `${field} exceeds ${max} chars` };
  }
  return { ok: true, value: v };
}

function tryParseUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // 1) Bearer auth
  const authHeader = request.headers.get("authorization") ?? "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return errJson("missing_bearer", 401);
  const token = m[1].trim();
  if (token.length === 0 || token.length > 256) {
    return errJson("invalid_bearer", 401);
  }
  const tokenHash = sha256Hex(token);

  // 2) Body parse + validate
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return errJson("invalid_json", 422);
  }

  const checks: Array<ReturnType<typeof asString>> = [];
  const wordR = asString(body.word, MAX_WORD, true, "word");
  if (!wordR.ok) return errJson("invalid_input", 422, wordR.err);
  const sourceR = asString(body.source, MAX_SOURCE, true, "source");
  if (!sourceR.ok) return errJson("invalid_input", 422, sourceR.err);
  const sourceUrlR = asString(body.sourceUrl, MAX_SOURCE_URL, false, "sourceUrl");
  if (!sourceUrlR.ok) return errJson("invalid_input", 422, sourceUrlR.err);
  const sourceTitleR = asString(body.sourceTitle, MAX_SOURCE_TITLE, false, "sourceTitle");
  if (!sourceTitleR.ok) return errJson("invalid_input", 422, sourceTitleR.err);
  const sourceDomainR = asString(body.sourceDomain, MAX_SOURCE_DOMAIN, false, "sourceDomain");
  if (!sourceDomainR.ok) return errJson("invalid_input", 422, sourceDomainR.err);
  const sourceFaviconR = asString(body.sourceFavicon, MAX_SOURCE_FAVICON, false, "sourceFavicon");
  if (!sourceFaviconR.ok) return errJson("invalid_input", 422, sourceFaviconR.err);

  // Defensive: sourceUrl if present must be a valid http(s) URL
  if (sourceUrlR.value && !tryParseUrl(sourceUrlR.value)) {
    return errJson("invalid_input", 422, "sourceUrl must be a valid http(s) URL");
  }

  // 3) Token → user lookup
  const admin = createAdminClient();
  const { data: tokenRow, error: tokenErr } = await admin
    .from("extension_tokens")
    .select("user_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (tokenErr) {
    console.error("POST /api/vocabulary token lookup failed:", tokenErr);
    return errJson("internal", 500);
  }
  if (!tokenRow) {
    return errJson("invalid_token", 401);
  }
  if (tokenRow.revoked_at) {
    return errJson("token_revoked", 403);
  }
  const userId = tokenRow.user_id;

  // 4) Rate limit — count rows from the last minute. Counts all inserts
  // (not just chrome-extension), but that's a conservative upper bound
  // and the limit is high enough that legitimate usage stays well under.
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount, error: countErr } = await admin
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneMinAgo);
  if (countErr) {
    // Non-fatal — log and continue (fail-open on the rate check).
    console.error("POST /api/vocabulary rate count failed:", countErr);
  } else if ((recentCount ?? 0) > RATE_LIMIT_PER_MIN) {
    return errJson("rate_limited", 429);
  }

  // 5) Duplicate check (per Frank 需求 §14)
  //     Same user + same word + same reading-or-both-null → duplicate.
  let dupQuery = admin
    .from("vocabulary_items")
    .select("id, word, reading, meaning")
    .eq("user_id", userId)
    .eq("word", wordR.value);
  // Reading is nullable; we want either NULL or the exact value.
  // Supabase/PostgREST: `is("reading", null)` for the null case,
  // `.eq("reading", v)` for the value case.
  dupQuery = sourceUrlR.value
    ? dupQuery // reading not used in dedup if sourceUrl set
    : dupQuery;
  void sourceUrlR; // (sourceUrl doesn't enter the dedup decision; keep
                    // it for context if V2 wants URL-based dedup.)

  // Two-step dedup: prefer exact match on (word, reading) including null.
  const { data: exactMatch } = await admin
    .from("vocabulary_items")
    .select("id, word, reading, meaning")
    .eq("user_id", userId)
    .eq("word", wordR.value)
    .is("reading", null)
    .maybeSingle();

  const incomingReading = ""; // Chrome extension MVP doesn't send reading
                              // (per 需求 §13: AI enrichment is async on
                              // backend, so reading isn't known yet at
                              // save time). Treat as null for dedup.
  void incomingReading;

  let duplicate: { id: string; word: string; reading: string | null; meaning: string } | null =
    exactMatch ?? null;

  // 6) Save — bypasses RLS via service-role. Scope by userId.
  if (!duplicate) {
    // AI enrichment (synchronous — ~1-3s) so the user gets a meaningful
    // meaningZh back in the response. Failure falls back to word-as-meaning.
    let meaningZh = wordR.value;
    let reading: string | null = null;
    let partOfSpeech: string | null = null;
    let level: string | null = null;

    try {
      const enriched = await enrichVocabulary(wordR.value, "word");
      if (enriched.meaning) meaningZh = enriched.meaning;
      reading = enriched.reading ?? null;
      partOfSpeech = enriched.part_of_speech ?? null;
      level = enriched.level ?? null;
    } catch (err) {
      console.warn("POST /api/vocabulary enrichment failed:", err);
      // Fall through with meaningZh = word.
    }

    const nowIso = new Date().toISOString();

    const { data: inserted, error: insertErr } = await admin
      .from("vocabulary_items")
      .insert({
        user_id: userId,
        type: "word",
        word: wordR.value,
        reading,
        meaning: meaningZh,
        language: "ja",
        part_of_speech: partOfSpeech,
        level,
        source: sourceR.value,
        source_url: sourceUrlR.value || null,
        source_title: sourceTitleR.value || null,
        source_domain: sourceDomainR.value || null,
        source_favicon: sourceFaviconR.value || null,
        source_added_at: nowIso,
      })
      .select("id, word, reading, meaning")
      .single();

    if (insertErr) {
      // Race condition: another request inserted the same word just now.
      // The unique index caught it. Re-fetch and return as duplicate.
      if (
        insertErr.code === "23505" /* unique_violation */
      ) {
        const { data: racedDup } = await admin
          .from("vocabulary_items")
          .select("id, word, reading, meaning")
          .eq("user_id", userId)
          .eq("word", wordR.value)
          .is("reading", null)
          .maybeSingle();
        if (racedDup) duplicate = racedDup;
      }
      if (!duplicate) {
        console.error("POST /api/vocabulary insert failed:", insertErr);
        return errJson("internal", 500);
      }
    } else if (inserted) {
      // Best-effort: generate a primary example sentence (per existing
      // createVocabularyItem pattern). Don't fail the create if AI
      // hiccups — the user can regenerate later from the detail page.
      try {
        await generateExampleAndAttach(admin, inserted.id, wordR.value, meaningZh, reading, "word");
      } catch (err) {
        console.warn("POST /api/vocabulary example generation failed:", err);
      }

      // Best-effort: ensure review row so the new vocab lands in /review.
      // ensureReviewRecord uses createClient() (cookie session) — for
      // Chrome extension we need to inline it via admin client.
      try {
        await ensureReviewRecordAdmin(admin, inserted.id, userId);
      } catch (err) {
        console.warn("POST /api/vocabulary ensureReviewRecord failed:", err);
      }

      // Best-effort: update token's last_used_at (fire-and-forget).
      void admin
        .from("extension_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("token_hash", tokenHash);

      return NextResponse.json(
        {
          success: true,
          duplicate: false,
          data: {
            id: inserted.id,
            word: inserted.word,
            reading: inserted.reading,
            meaningZh: inserted.meaning,
          },
        },
        { status: 201 },
      );
    }
  }

  // Duplicate path (200)
  if (duplicate) {
    // Update token last_used_at even on duplicate (the call is still a
    // legit interaction).
    void admin
      .from("extension_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("token_hash", tokenHash);

    return NextResponse.json(
      {
        success: true,
        duplicate: true,
        message: "已经收藏过了",
        data: {
          id: duplicate.id,
          word: duplicate.word,
          reading: duplicate.reading,
          meaningZh: duplicate.meaning,
        },
      },
      { status: 200 },
    );
  }

  // Shouldn't reach here, but keep the TS return path satisfied.
  return errJson("internal", 500);
}

// ----------------------------------------------------------------------------
// Local helpers (admin-scoped; mirrors lib/vocabulary/examples.ts +
// lib/vocabulary/reviews.ts but bypasses RLS for the service-role caller).
// ----------------------------------------------------------------------------

async function generateExampleAndAttach(
  admin: ReturnType<typeof createAdminClient>,
  vocabId: string,
  word: string,
  meaning: string,
  reading: string | null,
  type: "word" | "phrase" | "grammar" | "sentence",
): Promise<void> {
  const example = await generateExample({ word, meaning, reading, type });
  if (!example.sentence) return;
  const { error } = await admin.from("vocabulary_examples").insert({
    vocabulary_id: vocabId,
    sentence: example.sentence,
    translation: example.translation,
    reading: example.reading,
    is_primary: true,
    generated_by_ai: true,
  });
  if (error) {
    console.error("generateExampleAndAttach insert failed:", error);
  }
}

async function ensureReviewRecordAdmin(
  admin: ReturnType<typeof createAdminClient>,
  vocabularyId: string,
  userId: string,
): Promise<void> {
  const { data: existing } = await admin
    .from("vocabulary_reviews")
    .select("id")
    .eq("user_id", userId)
    .eq("vocabulary_id", vocabularyId)
    .maybeSingle();
  if (existing) return;
  const { error } = await admin.from("vocabulary_reviews").insert({
    user_id: userId,
    vocabulary_id: vocabularyId,
    next_review_at: new Date().toISOString(),
    interval_days: 0,
    ease_factor: 2.5,
    mastery: 0,
  });
  if (error) {
    console.error("ensureReviewRecordAdmin insert failed:", error);
  }
}