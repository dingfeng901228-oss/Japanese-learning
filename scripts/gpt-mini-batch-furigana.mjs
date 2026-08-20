// Batch enrich motto transcripts: add jaHtml (with <ruby> furigana) + zh translation.
// Per Frank #6429/#6442 (2026-08-20):
//   134 raw STT transcripts (from r2-transcribe-motto.mjs) →
//   134 enriched entries: { id, ja, jaHtml, zh, prefix, filename, url }
//
// Re-run is idempotent (overwrites data/motto-sentences.enriched.json).
// Output is consumed by lib/motto-sentences.ts (build-time copy).

import { readFile, writeFile } from "node:fs/promises";

const INPUT = "F:/WebSite/Japanese-learning-compare/data/motto-transcripts.json";
const OUTPUT = "F:/WebSite/Japanese-learning-compare/data/motto-sentences.enriched.json";
const ENV_FILE = "F:/WebSite/Japanese-learning-compare/.env.local";

async function readEnv() {
  try {
    const raw = await readFile(ENV_FILE, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^OPENAI_API_KEY=(.+)$/);
      if (m) return m[1].trim();
    }
  } catch {}
  return process.env.OPENAI_API_KEY || "";
}

const SYSTEM_PROMPT = `You are a Japanese teacher helping Chinese-speaking learners. For each Japanese dialogue transcript, you produce:

1. \`jaHtml\`: the same Japanese text but with kanji annotated using HTML <ruby> tags for furigana. Format: \`<ruby>漢字<rt>かんじ</rt></ruby>\`. Hiragana/katakana/katakana loanwords stay as-is. Do NOT split the dialogue — preserve the original line breaks using \\n. The same speaker's repeated lines stay verbatim (no need to re-render each one).

2. \`zh\`: a natural Chinese translation that captures the full conversation. Keep it as readable Chinese prose, not word-by-word. Multi-turn conversations should read like a Chinese dialogue.

Rules:
- Output strictly JSON: { "jaHtml": "...", "zh": "..." }
- No markdown, no commentary, no leading/trailing text outside the JSON object
- jaHtml must be valid HTML (use proper <ruby><rt>...</rt></ruby> tags)
- For kanji you don't know, pick a sensible reading from context
- Translate idiomatic phrases naturally, not literally`;

async function enrichOne(apiKey, item, retries = 3) {
  const userPrompt =
    `transcript:\n${item.ja}\n\n` +
    `Output JSON with jaHtml (furigana-annotated) and zh (Chinese translation).`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          max_tokens: 2500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      const j = await r.json();
      const text = j.choices[0]?.message?.content ?? "{}";
      const obj = JSON.parse(text);
      if (typeof obj.jaHtml !== "string" || typeof obj.zh !== "string") {
        throw new Error("missing jaHtml or zh");
      }
      return { jaHtml: obj.jaHtml, zh: obj.zh };
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function main() {
  const apiKey = await readEnv();
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY not found");
    process.exit(1);
  }
  const transcripts = JSON.parse(await readFile(INPUT, "utf-8"));
  console.log(`Enriching ${transcripts.length} transcripts…`);

  const enriched = [];
  let nextIdx = 0;
  let doneCount = 0;
  let failCount = 0;
  let t0 = Date.now();
  const CONCURRENCY = 5;

  async function worker(workerId) {
    while (true) {
      const i = nextIdx++;
      if (i >= transcripts.length) return;
      const item = transcripts[i];
      try {
        const { jaHtml, zh } = await enrichOne(apiKey, item);
        enriched[i] = { ...item, jaHtml, zh };
        doneCount++;
      } catch (e) {
        enriched[i] = { ...item, jaHtml: "", zh: "", error: e.message };
        failCount++;
        console.error(`❌ w${workerId} ${item.id}: ${e.message.slice(0, 80)}`);
      }
      if (doneCount % 10 === 0 || doneCount + failCount === transcripts.length) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  ${doneCount + failCount}/${transcripts.length} (${elapsed}s, ${failCount} fail)`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
  await writeFile(OUTPUT, JSON.stringify(enriched, null, 2), "utf-8");
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`✅ Done in ${elapsed}s → ${OUTPUT}`);
}

main().catch((e) => {
  console.error("Unhandled:", e);
  process.exit(99);
});