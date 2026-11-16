// The vocabulary list's filter vocabulary.
//
// Shared by the filter row (a Client Component) and the page (a Server
// Component). They cannot live in the "use client" module: every export
// of a client module is a client reference, and a Server Component
// cannot read one on the server.
//
// Audit 2026-11-16 P1-12: every URL parameter is an English enum and an
// unrecognised value is reported, not silently ignored.

import type { VocabularyType } from "@/lib/vocabulary";

export const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

export const TYPE_LABEL: Record<VocabularyType, string> = {
  word: "单词",
  phrase: "词组",
  grammar: "文法",
  sentence: "句型",
};

/** P1-10: the 掌握度区间 buckets — the same bands /progress uses. */
export const MASTERY_RANGES: {
  value: string;
  label: string;
  min?: number;
  max?: number;
}[] = [
  { value: "", label: "全部掌握度" },
  { value: "0-19", label: "0%–19%（生疏）", min: 0, max: 19 },
  { value: "20-49", label: "20%–49%（需加强）", min: 20, max: 49 },
  { value: "50-79", label: "50%–79%（接近掌握）", min: 50, max: 79 },
  { value: "80-100", label: "80%–100%（已掌握）", min: 80, max: 100 },
];

/** The 状态 filter options (P1-6 / P1-10). */
export const STATE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "全部状态" },
  { value: "due", label: "待复习" },
  { value: "mastered", label: "已掌握" },
  { value: "weak", label: "易忘" },
  { value: "starred", label: "★ 星标" },
  { value: "marked", label: "已标记" },
];

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "最新收藏" },
  { value: "oldest", label: "最早收藏" },
  { value: "word", label: "按 A-Z" },
  { value: "freq", label: "按常用度" },
];
