import OpenAI from "openai";
import { NextResponse } from "next/server";

// Force dynamic rendering — never evaluate at build time (env vars not available)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FeedbackLanguage = "zh" | "en";

// System prompts are parameterized by output language so the AI tutor's
// prose feedback (overall / grammar / vocabulary / strengths / improvements
// / encouragement) is written in the learner's preferred language.
// Field names + JSON schema stay English (machine-facing); content is
// human-facing and matches the toggle on /speaking.
function buildFeedbackSystemPrompt(lang: FeedbackLanguage): string {
  const langDirective =
    lang === "zh"
      ? "用中文（简体）写所有 prose feedback 字段：overall、naturalness、grammar、vocabulary、strengths、improvements、encouragement。日语例句保留原样。"
      : "Write all prose feedback fields (overall, naturalness, grammar, vocabulary, strengths, improvements, encouragement) in English. Keep Japanese example sentences in Japanese.";

  return `You are an expert Japanese language tutor providing end-of-session feedback to a Chinese-speaking learner at JLPT N2 level (upper-intermediate).

**Output language**: ${langDirective}

Analyze the entire conversation transcript and produce structured feedback in JSON only (no preamble, no markdown).

Focus areas:
1. **Grammar**: particles (は/が/を/に), verb conjugations (te-form, potential, passive), adjective forms, sentence ending patterns. Highlight specific mistakes with corrections.
2. **Vocabulary**: word choice, register (casual vs polite), collocations. Suggest more natural alternatives.
3. **Naturalness**: how native-speaker-like the learner's Japanese sounds. Note any textbook-isms or unnatural phrasing.
4. **Strengths**: what the learner did well — reinforce these patterns.
5. **Improvements**: concrete, actionable areas to work on.

Tone: encouraging but honest. The learner is at N2 level, so expect intermediate-advanced grammar. Don't patronize.

If the learner barely spoke (e.g. only the AI's opening greeting + 1 user reply), set grammar/vocabulary arrays to empty and explain in \`overall\` that there wasn't enough material to analyze.`;
}

type Turn = { role: "user" | "assistant"; content: string };

type Feedback = {
  overall: string;
  grammar: string[];
  vocabulary: string[];
  naturalness: string;
  strengths: string[];
  improvements: string[];
  encouragement: string;
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = (await req.json()) as {
      messages?: Turn[];
      language?: FeedbackLanguage;
    };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const language: FeedbackLanguage = body.language === "en" ? "en" : "zh";

    if (messages.length < 2) {
      return NextResponse.json(
        { error: "Need at least one exchange to generate feedback." },
        { status: 400 }
      );
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildFeedbackSystemPrompt(language) },
        {
          role: "user",
          content:
            "Here is the conversation transcript to analyze:\n\n" +
            messages
              .map(
                (m) =>
                  `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`
              )
              .join("\n\n"),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "conversation_feedback",
          schema: {
            type: "object",
            properties: {
              overall: {
                type: "string",
                description:
                  "2-3 sentence overall assessment of the learner's Japanese in this session.",
              },
              grammar: {
                type: "array",
                items: { type: "string" },
                description:
                  "Grammar mistakes observed, each item phrased as '<wrong> → <correct> because <reason>'.",
              },
              vocabulary: {
                type: "array",
                items: { type: "string" },
                description:
                  "Vocabulary suggestions, each item phrased as 'Instead of <word>, consider <word> (<nuance>)'.",
              },
              naturalness: {
                type: "string",
                description:
                  "Naturalness rating (1-10) with one-sentence explanation.",
              },
              strengths: {
                type: "array",
                items: { type: "string" },
                description:
                  "Specific patterns the learner used well — things to keep doing.",
              },
              improvements: {
                type: "array",
                items: { type: "string" },
                description:
                  "Concrete areas to work on next session (not the same as grammar mistakes — high-level patterns).",
              },
              encouragement: {
                type: "string",
                description: "Warm, motivating closing — one short paragraph.",
              },
            },
            required: [
              "overall",
              "grammar",
              "vocabulary",
              "naturalness",
              "strengths",
              "improvements",
              "encouragement",
            ],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.5,
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let feedback: Feedback;
    try {
      feedback = JSON.parse(raw) as Feedback;
    } catch {
      return NextResponse.json(
        { error: "Failed to parse feedback JSON", raw },
        { status: 500 }
      );
    }

    return NextResponse.json({ feedback, language });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}