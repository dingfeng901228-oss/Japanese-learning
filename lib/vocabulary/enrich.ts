// AI enrichment for vocabulary items. Given just the headword,
// generate missing fields (reading, meaning, JLPT level, part of
// speech) using gpt-4o-mini. Called from lib/vocabulary.ts
// `createVocabularyItem` — auto-fills when the caller leaves fields
// blank.
//
// Phase 1.5+ (per Frank #6176 — Vercel build was failing because
// `new OpenAI()` at module load threw when OPENAI_API_KEY wasn't set,
// even on pages like /vocabulary/[id] that only READ vocab data and
// never call AI functions). Fix: lazy-init the client so the SDK is
// only constructed when an AI function is actually invoked. Pages
// that just import `enrichVocabulary` as a type or read vocab data
// never trigger client creation → no more module-load error → builds
// pass even without OPENAI_API_KEY configured.
//
// Cost: ~$0.001 per call (gpt-4o-mini, ~150 input + ~80 output tokens).
// Latency: 1-3s typical.

import OpenAI from "openai";

// Lazy OpenAI client — only constructed on first AI call. This keeps
// module load side-effect-free so Vercel builds succeed without
// OPENAI_API_KEY (which only matters for write paths that actually
// invoke AI).
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    // Constructor reads OPENAI_API_KEY from env; throws if missing.
    // That throw is fine here — it only fires the first time someone
    // calls an AI function without the env var set, and the caller
    // already wraps in try/catch + falls back gracefully.
    _openai = new OpenAI();
  }
  return _openai;
}

export type EnrichmentResult = {
  reading: string | null;
  meaning: string;
  level: string | null;
  part_of_speech: string | null;
};

const SYSTEM_PROMPT = `You are a Japanese language learning assistant. Given a Japanese word, phrase, grammar pattern, or sentence, return a JSON object with exactly these keys:

{
  "reading": "<hiragana reading, no romaji, no kanji — or null if not applicable (e.g., already-kana text, kanji compound without standard reading)>",
  "meaning": "<at least 2 distinct Chinese meanings separated by 「，」 (full-width comma). Examples: \"高兴，愉快\" or \"方法，手段，办法\". List DIFFERENT senses / usages / contexts (not just synonyms). Each sense 1-8 chars ideal, total 1-30 chars. No quotes, no trailing period>",
  "level": "<one of: N5, N4, N3, N2, N1, or null if not classifiable>",
  "part_of_speech": "<Chinese name, e.g. 名词 / 动词 / 形容词 / 副词 / 助词 / 词组 / 句型 / 表达 — or null>"
}

Rules:
- Return ONLY the JSON object, no other text, no markdown fences.
- The reading field is helpful for kanji-heavy vocabulary; use null if the input has no kanji (e.g., already-hiragana-only text).
- For grammar patterns (e.g., 「〜ようにする」) and sentence templates, part_of_speech should be "句型" or "表达".
- For multi-word phrases, reading is the full kana reading of the whole phrase.
- If unsure about any field, use null rather than guessing. JLPT level and part_of_speech are the fields most often null.
- The meaning field MUST contain at least 2 senses separated by 「，」 (per Frank #7166 — a single-meaning answer is too one-sided for learning). If a word only has one sense, list the most common usage context + a close paraphrase (e.g., 嬉しい → "高兴的，愉快的") to fulfill the 2-minimum requirement.`;

export async function enrichVocabulary(
  word: string,
  _type: "word" | "phrase" | "grammar" | "sentence"
): Promise<EnrichmentResult> {
  const userContent = JSON.stringify({ word, type: _type });

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  let parsed: Partial<EnrichmentResult> = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    // Bad JSON — caller will see empty fields and fall back to word-as-meaning.
  }

  return {
    reading: typeof parsed.reading === "string" ? parsed.reading : null,
    meaning:
      typeof parsed.meaning === "string" && parsed.meaning
        ? parsed.meaning
        : word,
    level: typeof parsed.level === "string" ? parsed.level : null,
    part_of_speech:
      typeof parsed.part_of_speech === "string" ? parsed.part_of_speech : null,
  };
}
