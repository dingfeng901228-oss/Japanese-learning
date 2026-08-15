// P1.B — Structured grading output types (per-token diff + issue list).
//
// Shared between the server (app/api/grade/route.ts) and the client
// (app/listening/page.tsx). Lives in lib/ rather than under app/api/
// because Next.js disallows importing server-route files into "use client"
// components — keeping the type-only module side-effect free lets either
// side import it cleanly.
//
// Backward compatibility: `diff` and `issues` are OPTIONAL fields on the
// response. Older shadow-history entries (written before P1.B shipped)
// won't have them — the client falls back to its local `computeWordDiff()`
// helper. See app/listening/page.tsx for the fallback path.

export type TokenStatus = "matched" | "mismatched";

/**
 * A single Japanese token in the diff view.
 *
 * - `text`: the surface form used for rendering (mirrors `target` when matched
 *   and falls back to `transcript` when there is no target — e.g. extra words).
 * - `target`: the canonical token from the reference sentence.
 * - `transcript`: what the learner said (or what STT heard).
 * - `status`: whether the learner reproduced the token correctly.
 * - `transcriptForm`: optional reading-form the learner used (kanji → kana);
 *   only set when there's a kanji-vs-kana mismatch worth surfacing.
 */
export type DiffToken = {
  text: string;
  target: string;
  transcript: string;
  status: TokenStatus;
  transcriptForm?: string;
};

/**
 * Per-token alignment between target and transcript.
 *
 * `matchRate` is the fraction (0..1) of non-separator target tokens that
 * matched. The route computes it as `matched / total`. If the model omits
 * tokens entirely (malformed response), the route falls back to the
 * client-side `computeWordDiff()` helper, so leaving `tokens: []` is safe.
 */
export type Diff = {
  tokens: DiffToken[];
  matchRate: number;
};

export type IssueType =
  | "particle-confusion" // は/が/を/に
  | "kanji-reading" // 汉字读音错
  | "pitch-accent" // 重音位置错 (N3+)
  | "verb-conjugation" // 活用形错
  | "missing-word" // 丢词
  | "extra-word" // 多词
  | "word-order"; // 语序错

export type Severity = "minor" | "major" | "critical";

/**
 * A single structured error. The `tokenIndex` is the index into
 * `diff.tokens[]` so the client can attach a tooltip to the exact
 * mismatched token. `expected` and `heard` are short strings (one or two
 * characters for particle errors, longer for kanji readings).
 */
export type Issue = {
  type: IssueType;
  tokenIndex: number;
  expected: string;
  heard: string;
  severity: Severity;
  hint: string;
};

/**
 * Wire shape returned by /api/grade.
 *
 * `grade` mirrors the original Phase 2 contract — accuracy / fluency /
 * feedback / suggestions / encouragement. P1.B adds `diff` and `issues`
 * as optional additive fields; clients written before P1.B ignore them
 * and keep working.
 */
export type GradeResponse = {
  grade: {
    accuracy: number;
    fluency: number;
    feedback: string;
    suggestions: string[];
    encouragement: string;
  };
  sentenceId: string;
  diff?: Diff;
  issues?: Issue[];
};

// Human-readable labels for the issue type chips rendered on the result card.
// Kept here (rather than inline in the page) so the legend stays in sync if
// new types are added.
export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  "particle-confusion": "助词错",
  "kanji-reading": "汉字读音",
  "pitch-accent": "重音位置",
  "verb-conjugation": "动词活用",
  "missing-word": "丢词",
  "extra-word": "多词",
  "word-order": "语序错",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  minor: "轻微",
  major: "重要",
  critical: "严重",
};
