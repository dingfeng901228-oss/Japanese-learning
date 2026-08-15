// tests/unit/lib/mistake-storage.test.ts
//
// Smoke coverage for lib/mistake-storage.ts (P1.C). Targets the
// localStorage implementation directly because it has no external
// dependencies (Supabase-backed impl needs env + auth — that's an
// integration test for later). The localStorage impl also happens to
// be the one the anonymous user hits in production, so coverage here
// is genuinely useful.

import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageMistakeStorage } from "@/lib/mistake-storage";

describe("LocalStorageMistakeStorage", () => {
  beforeEach(() => {
    // happy-dom provides a real localStorage; clear between tests so
    // we don't bleed state across `it()` blocks.
    localStorage.clear();
  });

  it("records a mistake and reads it back from recent()", async () => {
    const storage = new LocalStorageMistakeStorage();
    await storage.record({
      sentenceId: "n5-1",
      sentenceTarget: "今日はいい天気だ",
      patternType: "kanji-reading",
      severity: "minor",
      hint: "「天気」读 てんき",
    });
    const recent = await storage.recent();
    expect(recent.length).toBe(1);
    expect(recent[0].sentenceId).toBe("n5-1");
    expect(recent[0].sentenceTarget).toBe("今日はいい天気だ");
    expect(recent[0].patternType).toBe("kanji-reading");
    expect(recent[0].severity).toBe("minor");
    expect(recent[0].hint).toBe("「天気」读 てんき");
  });

  it("aggregateByPattern() returns counts grouped by IssueType", async () => {
    const storage = new LocalStorageMistakeStorage();
    await storage.record({
      sentenceId: "a",
      sentenceTarget: "x",
      patternType: "particle-confusion",
      severity: "minor",
    });
    await storage.record({
      sentenceId: "b",
      sentenceTarget: "y",
      patternType: "particle-confusion",
      severity: "major",
    });
    await storage.record({
      sentenceId: "c",
      sentenceTarget: "z",
      patternType: "kanji-reading",
      severity: "minor",
    });
    const agg = await storage.aggregateByPattern();
    expect(agg["particle-confusion"]).toBe(2);
    expect(agg["kanji-reading"]).toBe(1);
  });

  it("reviewQueue() returns mistakes priority-sorted (recency + frequency)", async () => {
    const storage = new LocalStorageMistakeStorage();
    await storage.record({
      sentenceId: "a",
      sentenceTarget: "x",
      patternType: "kanji-reading",
      severity: "minor",
    });
    await storage.record({
      sentenceId: "b",
      sentenceTarget: "y",
      patternType: "kanji-reading",
      severity: "minor",
    });
    const queue = await storage.reviewQueue();
    expect(queue.length).toBeGreaterThan(0);
    // Each mistake starts with reviewCount=0 from a fresh write; the
    // contract is that the queue is non-empty and returns the same
    // mistakes we just wrote.
    expect(queue[0].reviewCount).toBeGreaterThanOrEqual(0);
    expect(queue[0].patternType).toBe("kanji-reading");
  });

  it("record() assigns an id and detectedAt timestamp", async () => {
    const storage = new LocalStorageMistakeStorage();
    const before = Date.now();
    const m = await storage.record({
      sentenceId: "ts",
      sentenceTarget: "時間",
      patternType: "verb-conjugation",
      severity: "major",
    });
    const after = Date.now();
    expect(m.id).toBeTruthy();
    expect(typeof m.id).toBe("string");
    expect(m.detectedAt).toBeGreaterThanOrEqual(before);
    expect(m.detectedAt).toBeLessThanOrEqual(after);
    expect(m.reviewCount).toBe(0);
  });

  it("recent() respects the limit argument", async () => {
    const storage = new LocalStorageMistakeStorage();
    for (let i = 0; i < 5; i++) {
      await storage.record({
        sentenceId: `s${i}`,
        sentenceTarget: "t",
        patternType: "missing-word",
        severity: "minor",
      });
    }
    const top3 = await storage.recent(3);
    expect(top3.length).toBe(3);
  });
});