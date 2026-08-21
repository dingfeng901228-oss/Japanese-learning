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

/**
 * Best-effort JSON extraction from LLM response. Handles the common
 * failure modes that broke the "Failed to parse feedback JSON" 500
 * errors Frank reported in #6601:
 *   - empty / whitespace-only content (content filter, truncation)
 *   - markdown code fences ```json ... ``` or ``` ... ```
 *   - preamble text before the JSON object
 *   - missing required fields (json_schema should prevent this but
 *     safety filters / token limits / model quirks can still slip through)
 *
 * Returns null on any parse or validation failure. Caller decides
 * whether to fall back to a default Feedback object or surface 500.
 */
function tryParseFeedback(raw: string): Feedback | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;

  // Strip ```json ... ``` or ``` ... ``` fences
  const fenceMatch = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch && fenceMatch[1]) {
    s = fenceMatch[1].trim();
    if (!s) return null;
  }

  // Extract the first JSON object if there's preamble text
  if (!s.startsWith("{")) {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first === -1 || last <= first) return null;
    s = s.slice(first, last + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  // Validate required fields — json_schema should guarantee this but
  // safety filters / token limits / model quirks can still break it.
  const f = parsed as Record<string, unknown>;
  if (
    typeof f.overall !== "string" ||
    typeof f.naturalness !== "string" ||
    typeof f.encouragement !== "string" ||
    !Array.isArray(f.grammar) ||
    !Array.isArray(f.vocabulary) ||
    !Array.isArray(f.strengths) ||
    !Array.isArray(f.improvements)
  ) {
    return null;
  }

  return f as unknown as Feedback;
}

/**
 * Last-resort Feedback object when the LLM response can't be parsed
 * or validated. We still return 200 (not 500) so the speaking page
 * UI stays usable — it renders the fallback message in `overall`
 * instead of breaking on a raw error string.
 */
function fallbackFeedback(language: FeedbackLanguage): Feedback {
  const isZh = language === "zh";
  return {
    overall: isZh
      ? "反馈生成失败，请稍后再试。"
      : "Feedback generation failed. Please try again later.",
    grammar: [],
    vocabulary: [],
    naturalness: isZh ? "反馈生成失败。" : "Feedback generation failed.",
    strengths: [],
    improvements: [],
    encouragement: isZh ? "请稍后再试一次。" : "Please try again later.",
  };
}

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

    const raw = completion.choices[0]?.message?.content ?? "";
    const feedback = tryParseFeedback(raw);
    if (!feedback) {
      // Log for debugging — what did the LLM actually return vs what
      // we expected? finish_reason is especially useful (length = hit
      // max_tokens truncation, content_filter = safety filter).
      console.error("[api/feedback] failed to parse LLM response", {
        raw: raw.slice(0, 500),
        rawLength: raw.length,
        finishReason: completion.choices[0]?.finish_reason,
      });
      // Return 200 with fallback — UI stays usable instead of breaking
      // on a raw error string (per Frank #6603).
      return NextResponse.json({
        feedback: fallbackFeedback(language),
        language,
      });
    }

    return NextResponse.json({ feedback, language });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}