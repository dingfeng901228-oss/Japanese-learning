// P1.B — OpenAI Structured Outputs JSON Schema for /api/grade.
//
// TypeScript types live in lib/grade-types.ts (importable from both the
// server route and the client). This file holds the JSON Schema constant
// passed to `response_format: { type: "json_schema" }` so gpt-4o-mini
// returns a strictly typed response — no markdown fences, no missing
// fields, no hallucinated keys.
//
// When you add or rename a field in lib/grade-types.ts, mirror it here.

export type {
  Diff,
  DiffToken,
  GradeResponse,
  Issue,
  IssueType,
  Severity,
  TokenStatus,
} from "../../../lib/grade-types";

export const gradeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    grade: {
      type: "object",
      additionalProperties: false,
      properties: {
        accuracy: { type: "integer", minimum: 0, maximum: 100 },
        fluency: { type: "integer", minimum: 0, maximum: 100 },
        feedback: { type: "string" },
        suggestions: {
          type: "array",
          items: { type: "string" },
        },
        encouragement: { type: "string" },
      },
      required: ["accuracy", "fluency", "feedback", "suggestions", "encouragement"],
    },
    sentenceId: { type: "string" },
    diff: {
      type: "object",
      additionalProperties: false,
      properties: {
        tokens: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string" },
              target: { type: "string" },
              transcript: { type: "string" },
              status: {
                type: "string",
                enum: ["matched", "mismatched"],
              },
              transcriptForm: { type: "string" },
            },
            required: ["text", "target", "transcript", "status"],
          },
        },
        matchRate: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["tokens", "matchRate"],
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: [
              "particle-confusion",
              "kanji-reading",
              "pitch-accent",
              "verb-conjugation",
              "missing-word",
              "extra-word",
              "word-order",
            ],
          },
          tokenIndex: { type: "integer", minimum: 0 },
          expected: { type: "string" },
          heard: { type: "string" },
          severity: {
            type: "string",
            enum: ["minor", "major", "critical"],
          },
          hint: { type: "string" },
        },
        required: ["type", "tokenIndex", "expected", "heard", "severity", "hint"],
      },
    },
  },
  required: ["grade", "sentenceId"],
} as const;
