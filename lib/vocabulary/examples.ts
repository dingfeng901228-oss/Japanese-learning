// AI example sentence generation for vocabulary items. Given a
// vocabulary item (word, meaning, optional reading, type), generate
// ONE natural Japanese example sentence + Simplified Chinese
// translation + optional hiragana reading.
//
// Called from:
//   - lib/vocabulary.ts `createVocabularyItem` — auto-attach a primary
//     example when the user adds a vocab (Phase 3).
//   - app/vocabulary/actions.ts `regenerateExampleAction` — replace
//     the primary example when the user clicks "重新生成" on the
//     detail page (Phase 4 lite).
//
// Phase 1.5+ (per Frank #6176): same lazy OpenAI init pattern as
// `enrich.ts` — the SDK is only constructed on first AI call so
// Vercel builds don't fail when OPENAI_API_KEY isn't configured.
// Pages that only READ vocab data (like /vocabulary/[id]) never
// touch the client.
//
// Cost: ~$0.001 per call (gpt-4o-mini, ~250 input + ~80 output tokens).
// Latency: 1-3s typical.

import OpenAI from "openai";

// Lazy OpenAI client — see `enrich.ts` for the rationale.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI();
  }
  return _openai;
}

export type GeneratedExample = {
  sentence: string;
  translation: string | null;
  reading: string | null;
};

const SYSTEM_PROMPT = `You are a Japanese language tutor. Given a vocabulary item (Japanese word/phrase/grammar/sentence + Chinese meaning + optional reading + type), generate ONE natural example sentence that demonstrates typical usage. Return JSON:

{
  "sentence": "<Japanese example, 8-25 chars ideal, uses the word naturally in context>",
  "translation": "<Simplified Chinese translation of the sentence, no quotes, no trailing period>",
  "reading": "<full hiragana reading of the sentence, no romaji, no kanji — or null if the sentence has no kanji>"
}

Rules:
- Return ONLY the JSON object, no other text, no markdown fences.
- The example should be natural and useful for a learner at JLPT N3-N2 level.
- For grammar patterns and sentence templates, the example MUST show the pattern in actual use, not just the pattern itself.
- For words/phrases, the example should show the word in a real sentence context.
- The reading field is helpful for kanji-heavy sentences; use null if the sentence has no kanji (e.g., already-hiragana-only text).
- Aim for sentences a learner would actually read, not textbook examples.`;

export async function generateExample(item: {
  word: string;
  meaning: string;
  reading: string | null;
  type: string;
}): Promise<GeneratedExample> {
  const userContent = JSON.stringify({
    word: item.word,
    meaning: item.meaning,
    reading: item.reading,
    type: item.type,
  });

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  let parsed: Partial<GeneratedExample> = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    // Bad JSON — caller will see empty sentence and skip the insert.
  }

  return {
    sentence:
      typeof parsed.sentence === "string" ? parsed.sentence.trim() : "",
    translation:
      typeof parsed.translation === "string" && parsed.translation.trim()
        ? parsed.translation.trim()
        : null,
    reading:
      typeof parsed.reading === "string" && parsed.reading.trim()
        ? parsed.reading.trim()
        : null,
  };
}
