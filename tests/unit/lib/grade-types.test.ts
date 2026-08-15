// tests/unit/lib/grade-types.test.ts
//
// Smoke coverage for lib/grade-types.ts (P1.B). The file has no runtime
// logic — just const label maps and types — but we want a regression
// guard so a new IssueType added to the union forces the dev to add a
// label entry (otherwise chips render as empty strings on the result
// card).

import { describe, it, expect } from "vitest";
import {
  ISSUE_TYPE_LABELS,
  SEVERITY_LABELS,
  type IssueType,
  type Severity,
} from "@/lib/grade-types";

describe("grade-types enums", () => {
  it("ISSUE_TYPE_LABELS covers all 7 IssueType values", () => {
    const types: IssueType[] = [
      "particle-confusion",
      "kanji-reading",
      "pitch-accent",
      "verb-conjugation",
      "missing-word",
      "extra-word",
      "word-order",
    ];
    expect(types).toHaveLength(7);
    for (const t of types) {
      expect(ISSUE_TYPE_LABELS[t]).toBeTruthy();
      expect(typeof ISSUE_TYPE_LABELS[t]).toBe("string");
      expect(ISSUE_TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
  });

  it("SEVERITY_LABELS covers all 3 Severity values", () => {
    const sevs: Severity[] = ["minor", "major", "critical"];
    expect(sevs).toHaveLength(3);
    for (const s of sevs) {
      expect(SEVERITY_LABELS[s]).toBeTruthy();
      expect(typeof SEVERITY_LABELS[s]).toBe("string");
      expect(SEVERITY_LABELS[s].length).toBeGreaterThan(0);
    }
  });

  it("ISSUE_TYPE_LABELS has exactly 7 keys (no stale or missing entries)", () => {
    expect(Object.keys(ISSUE_TYPE_LABELS)).toHaveLength(7);
  });

  it("SEVERITY_LABELS has exactly 3 keys", () => {
    expect(Object.keys(SEVERITY_LABELS)).toHaveLength(3);
  });
});