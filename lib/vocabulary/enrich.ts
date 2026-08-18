// AI enrichment for vocabulary items. Given just the headword,
// generate missing fields (reading, meaning, JLPT level, part of
// speech) using gpt-4o-mini. Called from lib/vocabulary.ts
// `createVocabularyItem` when the caller doesn't supply those fields.
//
// Designed for Japanese — the rest of the app hardcodes language="ja".
// response_format: json_object guarantees parseable output.
//
// Cost: ~$0.001 per call (gpt-4o-mini, ~150 input tokens + ~80 output).
// Latency: 1-3 s typical. The form's submit button shows "AI 补全中…"
// via useFormStatus so the user knows the request is in flight.

import OpenAI from "openai";

const openai = new OpenAI();

export type EnrichmentResult = {
  reading: string | null;
  meaning: string;
  level: string | null;
  part_of_speech: string | null;
};

const SYSTEM_PROMPT = `You are a Japanese vocabulary learning assistant. Given a Japanese word, phrase, grammar pattern, or sentence, return a JSON object with exactly these keys:

{
  "reading": "<hiragana reading, no romaji, no kanji — or null if not applicable (e.g., already-kana text, kanji compound without standard reading)>",
  "meaning": "<concise Chinese meaning (Simplified Chinese). 1-12 chars ideal, no quotes, no trailing period>",
  "level": "<one of: N5, N4, N3, N2, N1, or null if not classifiable>",
  "part_of_speech": "<Chinese name, e.g. 名词 / 动词 / 形容词 / 副词 / 助词 / 词组 / 句型 / 表达 — or null>"
}

Rules:
- Return ONLY the JSON object, no other text, no markdown fences.
- For grammar patterns (e.g., 「〜ようにする」) and sentence templates, part_of_speech should be "句型" or "表达".
- For multi-word phrases, reading is the full kana reading of the whole phrase.
- If unsure about any field, use null rather than guessing. Part of speech and JLPT level are the fields most often null.`;

export async function enrichVocabulary(
  word: string,
  _type: "word" | "phrase" | "grammar" | "sentence"
): Promise<EnrichmentResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: word },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  let parsed: Partial<EnrichmentResult> = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    // Bad JSON — leave parsed empty so caller falls back to word-as-meaning.
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
