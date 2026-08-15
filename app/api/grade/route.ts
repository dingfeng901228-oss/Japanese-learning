import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  type Diff,
  type DiffToken,
  type Issue,
  type IssueType,
  type Severity,
  gradeJsonSchema,
} from "./schema";

// Force dynamic rendering — never evaluate at build time (env vars not available)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GradeRequest = {
  transcript: string;
  target: string;
  sentenceId: string;
  categoryLabel: string;
};

const ISSUE_TYPES: IssueType[] = [
  "particle-confusion",
  "kanji-reading",
  "pitch-accent",
  "verb-conjugation",
  "missing-word",
  "extra-word",
  "word-order",
];

const SEVERITIES: Severity[] = ["minor", "major", "critical"];

const SYSTEM_PROMPT = `你是给中文母语者的日语发音教练。学员读了一段日语句子，AI STT 把他们的语音转写成了 transcript。请对比 transcript 和 target（原文），给出评分 + 中文反馈 + 结构化错误列表。

评分维度 (0-100)：
- accuracy: 单词准确度。100 = transcript 与 target 完全一致；80+ = 可懂、轻微差异；60+ = 主要词识别对；<60 = 重要缺漏
- fluency: 流畅度。看 transcript 是否完整、有没有明显漏音节或过长停顿

输出严格的 JSON（不要 markdown 代码块、不要解释）。结构如下：

{
  "grade": {
    "accuracy": 0-100,
    "fluency": 0-100,
    "feedback": "一句话中文点评",
    "suggestions": ["建议1", "建议2", ...],
    "encouragement": "一句中文鼓励"
  },
  "sentenceId": "<原样回传 sentenceId>",
  "diff": {
    "tokens": [
      { "text": "今日",  "target": "今日",  "transcript": "今日",  "status": "matched"   },
      { "text": "は",     "target": "は",     "transcript": "は",     "status": "matched"   },
      { "text": "天気",   "target": "天気",   "transcript": "てんき", "status": "mismatched", "transcriptForm": "てんき" },
      { "text": "だ",     "target": "だ",     "transcript": "だ",     "status": "matched"   }
    ],
    "matchRate": 0.85
  },
  "issues": [
    {
      "type": "kanji-reading",
      "tokenIndex": 2,
      "expected": "天気",
      "heard": "てんき",
      "severity": "minor",
      "hint": "「天」读 てん, 「気」读 き; 重音是 だいか (平板)"
    }
  ]
}

要求：
- suggestions 必须 actionable：指出哪个字 / 哪个音 / 哪个语法点。不要"加油"/"好棒"等空话。每条 ≤ 30 字
- encouragement 也要具体到学员的尝试，避免空洞
- transcript 与 target 完全一致时，accuracy 直接给 100，diff.tokens 全部 "matched"，issues 为空数组
- transcript 为空（学员没说话）时，accuracy 给 0，fluency 给 0，feedback 提示"没听清，请再试一次"，diff.tokens 一项（status: "mismatched"），issues 为空数组

diff.tokens 切分规则：
- 用 target 顺序切，按「词」粒度：助词（は/が/を/に/で/から/まで/へ/と/の）、名词、形容词、动词、形容动词都单独成 token
- 标点（、。「」!?）和空格单独成 token，status 永远 "matched"（它们不影响发音评分）
- matched: 学员转写里的对应片段等于 target（含 汉字 / 假名完全一致）
- mismatched: 学员读错 / 读漏 / 多读 / 语序错
- transcriptForm: 仅当 汉字 target 被读成 假名（kanji-reading 错）时填，填学员实际读的 假名

issues 规则（每条必填 type/expected/heard/severity/hint）：
- type ∈ {"particle-confusion","kanji-reading","pitch-accent","verb-conjugation","missing-word","extra-word","word-order"}
- severity ∈ {"minor","major","critical"}：minor = 影响可懂度的轻微偏差，major = 错词 / 错音节 / 重要助词错，critical = 句意根本改变 / 完全没读出来
- tokenIndex 指向 diff.tokens 中对应的位置（matched token 也可以挂 issue，但要合理）
- hint ≤ 50 字中文，说明怎么纠正，不要堆术语

matchRate = matched 数 / (matched + mismatched) 数（不含标点）。`;

function clamp(n: unknown, fallback: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampRate(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function parseDiff(raw: unknown): Diff | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const tokensRaw = obj.tokens;
  const matchRateRaw = obj.matchRate;
  if (!Array.isArray(tokensRaw)) return undefined;

  const tokens: DiffToken[] = [];
  for (const t of tokensRaw) {
    if (!t || typeof t !== "object") continue;
    const tt = t as Record<string, unknown>;
    const status = tt.status;
    if (status !== "matched" && status !== "mismatched") continue;
    const text = typeof tt.text === "string" ? tt.text : "";
    const target = typeof tt.target === "string" ? tt.target : "";
    const transcript = typeof tt.transcript === "string" ? tt.transcript : "";
    const transcriptForm =
      typeof tt.transcriptForm === "string" && tt.transcriptForm.length > 0
        ? tt.transcriptForm
        : undefined;
    tokens.push({ text, target, transcript, status, transcriptForm });
  }

  return {
    tokens,
    matchRate: clampRate(matchRateRaw),
  };
}

function parseIssues(raw: unknown): Issue[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const issues: Issue[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const ii = it as Record<string, unknown>;
    const type = ii.type;
    if (typeof type !== "string" || !ISSUE_TYPES.includes(type as IssueType))
      continue;
    const severity = ii.severity;
    if (
      typeof severity !== "string" ||
      !SEVERITIES.includes(severity as Severity)
    )
      continue;
    const tokenIndex =
      typeof ii.tokenIndex === "number" && Number.isFinite(ii.tokenIndex)
        ? Math.max(0, Math.floor(ii.tokenIndex))
        : 0;
    const expected = typeof ii.expected === "string" ? ii.expected : "";
    const heard = typeof ii.heard === "string" ? ii.heard : "";
    const hint = typeof ii.hint === "string" ? ii.hint : "";
    issues.push({
      type: type as IssueType,
      tokenIndex,
      expected,
      heard,
      severity: severity as Severity,
      hint,
    });
  }
  return issues;
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
      `请评分 + 给反馈 + 输出 diff.tokens 和 issues。只输出 JSON。`;

    // P1.B — Structured Outputs: pin the model to the exact JSON schema
    // defined in schema.ts so diff / issues are guaranteed well-typed when
    // the response parses successfully. gpt-4o-mini supports
    // `response_format: { type: "json_schema" }`; if it ever stops, we fall
    // back to `json_object` + careful parsing.
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "grade_response",
            description:
              "Structured Shadow grading: score + per-token diff + issue list.",
            schema: gradeJsonSchema,
            strict: true,
          },
        },
        max_tokens: 1200,
      });
    } catch {
      // Fallback: some OpenAI accounts / proxies don't support json_schema
      // strict mode. Fall back to plain json_object and rely on parseDiff /
      // parseIssues to drop malformed pieces.
      completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 1200,
      });
    }

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Don't silently corrupt the response shape — caller (client) relies
      // on grade.{accuracy,...} being present. 500 with a clear error.
      return NextResponse.json(
        { error: "Failed to parse model output", raw },
        { status: 500 }
      );
    }

    const obj = (parsed ?? {}) as Record<string, unknown>;
    const gradeObj = (obj.grade ?? {}) as Record<string, unknown>;

    const grade = {
      accuracy: clamp(gradeObj.accuracy, 0),
      fluency: clamp(gradeObj.fluency, 0),
      feedback: typeof gradeObj.feedback === "string" ? gradeObj.feedback : "",
      suggestions: isStringArray(gradeObj.suggestions) ? gradeObj.suggestions : [],
      encouragement:
        typeof gradeObj.encouragement === "string"
          ? gradeObj.encouragement
          : "",
    };

    const diff = parseDiff(obj.diff);
    const issues = parseIssues(obj.issues);

    // Build the response shape. diff / issues are omitted if parsing
    // failed entirely (so the client falls back to computeWordDiff()).
    const response: {
      grade: typeof grade;
      sentenceId: string;
      diff?: Diff;
      issues?: Issue[];
    } = {
      grade,
      sentenceId,
    };
    if (diff) response.diff = diff;
    if (issues && issues.length > 0) response.issues = issues;

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
