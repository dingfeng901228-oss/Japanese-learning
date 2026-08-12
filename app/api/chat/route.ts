import OpenAI from "openai";
import { NextResponse } from "next/server";

// Force dynamic rendering — never evaluate at build time (env vars not available)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a Japanese language tutor for a Chinese-speaking learner (N2 level).

Your primary goal: maximize the learner's Japanese output.

Rules:
1. Maintain natural conversation. Do NOT interrupt to correct every mistake immediately — record it mentally for end-of-session feedback.
2. Reply in Japanese by default. Use brief Chinese explanation only when the learner is genuinely stuck.
3. Match N2-level Japanese. Avoid obscure N1 vocabulary unless the learner has used it themselves.
4. Keep replies concise (1-3 sentences) so the learner has room to respond.
5. If the learner is silent or stuck, gently prompt with a simple question.
6. Be warm and encouraging, like a patient tutor — not a strict examiner.

Context: this is FastStudy 2.0, an AI-driven Japanese listening & speaking trainer.`;

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
      max_tokens: 300,
    });

    const reply = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}