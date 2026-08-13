import OpenAI from "openai";
import { NextResponse } from "next/server";

// Force dynamic rendering — never evaluate at build time (env vars not available)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GradeRequest = {
  transcript: string;
  target: string;
  sentenceId: string;
  categoryLabel: string;
};

type Grade = {
  accuracy: number;
  fluency: number;
  feedback: string;
  suggestions: string[];
  encouragement: string;
};

const SYSTEM_PROMPT = `你是给中文母语者的日语发音教练。学员读了一段日语句子，AI STT 把他们的语音转写成了 transcript。请对比 transcript 和 target（原文），给出评分 + 中文反馈。

评分维度 (0-100)：
- accuracy: 单词准确度。100 = transcript 与 target 完全一致；80+ = 可懂、轻微差异；60+ = 主要词识别对；<60 = 重要缺漏
- fluency: 流畅度。看 transcript 是否完整、有没有明显漏音节或过长停顿

输出严格的 JSON（不要 markdown 代码块、不要解释）：
{
  "accuracy": 0-100,
  "fluency": 0-100,
  "feedback": "一句话中文点评",
  "suggestions": ["建议1", "建议2", ...],
  "encouragement": "一句中文鼓励"
}

要求：
- suggestions 必须 actionable：指出哪个字 / 哪个音 / 哪个语法点。不要"加油"/"好棒"等空话。每条 ≤ 30 字
- encouragement 也要具体到学员的尝试，避免空洞
- transcript 与 target 完全一致时，accuracy 直接给 100
- transcript 为空（学员没说话）时，accuracy 给 0，fluency 给 0，feedback 提示"没听清，请再试一次"`;

function clamp(n: unknown, fallback: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
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
    const body = (await req.json()) as GradeRequest;
    const { transcript, target, sentenceId, categoryLabel } = body;

    if (!transcript || !target) {
      return NextResponse.json(
        { error: "transcript and target required" },
        { status: 400 }
      );
    }

    const userPrompt =
      `分类：${categoryLabel}\n` +
      `原文 (target)：${target}\n` +
      `学员朗读 (transcript)：${transcript}\n\n` +
      `请评分 + 给反馈。只输出 JSON。`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse grading response", raw },
        { status: 500 }
      );
    }

    const obj = (parsed ?? {}) as Record<string, unknown>;

    const grade: Grade = {
      accuracy: clamp(obj.accuracy, 0),
      fluency: clamp(obj.fluency, 0),
      feedback: typeof obj.feedback === "string" ? obj.feedback : "",
      suggestions: Array.isArray(obj.suggestions)
        ? (obj.suggestions.filter((s) => typeof s === "string") as string[])
        : [],
      encouragement:
        typeof obj.encouragement === "string" ? obj.encouragement : "",
    };

    return NextResponse.json({
      grade,
      sentenceId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
