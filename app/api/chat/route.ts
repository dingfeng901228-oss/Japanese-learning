import OpenAI from "openai";
import { NextResponse } from "next/server";

// Force dynamic rendering — never evaluate at build time (env vars not available)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a Japanese language tutor for a Chinese-speaking learner (N2 level).

Your primary goal: maximize the learner's Japanese output.

Reply rules:
1. Maintain natural conversation. Do NOT interrupt to correct every mistake immediately — record it mentally for end-of-session feedback.
2. Reply in Japanese by default. Use brief Chinese explanation only when the learner is genuinely stuck.
3. Match N2-level Japanese. Avoid obscure N1 vocabulary unless the learner has used it themselves.
4. Keep replies concise (1-3 sentences) so the learner has room to respond.
5. If the learner is silent or stuck, gently prompt with a simple question.
6. Be warm and encouraging, like a patient tutor — not a strict examiner.

Context: this is FastStudy 2.0, an AI-driven Japanese listening & speaking trainer.

Output format (CRITICAL — strict JSON, no markdown fences, no extra text):
{
  "reply":       "<plain Japanese sentence(s) — exactly what you would say>",
  "jaHtml":      "<the same reply with <ruby> tags annotating each kanji. Hiragana readings only. Example: 今日は → <ruby>今日<rt>きょう</rt></ruby>は. Each kanji wrapped separately. All tags properly closed.>",
  "translation": "<natural Chinese translation of the reply>"
}

Constraints:
- jaHtml must contain ONLY <ruby> and <rt> tags (and plain text). No other HTML.
- Reading inside <rt> must be hiragana, never katakana.
- For 送りがな (okurigana), the okurigana stays outside the <ruby>; only the kanji part is wrapped.
- All three fields are required. Reply must be a non-empty string.`;

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Lazy-init the OpenAI client so missing env var at build time doesn't crash.
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = (await req.json()) as { messages?: Turn[] };
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 600,
      // Per Frank #6342: reply + jaHtml + translation in one call so the
      // /speaking UI can render ruby annotations + show the Chinese
      // translation on demand without a second round-trip.
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let reply = "";
    let translation: string | undefined;
    let jaHtml: string | undefined;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.reply === "string") reply = parsed.reply;
      if (typeof parsed.translation === "string") translation = parsed.translation;
      if (typeof parsed.jaHtml === "string") jaHtml = parsed.jaHtml;
    } catch {
      // JSON parse failed (model returned non-JSON). Fall back to using
      // the raw content as plain reply — keeps the conversation working
      // even if the structured-output instruction is ignored.
      reply = raw;
    }
    return NextResponse.json({ reply, translation, jaHtml });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}