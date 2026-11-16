"use client";

/**
 * The star and the manual 已掌握 / 易忘 marks (P1-10).
 *
 * The audit: "生词标记：加星标、自定义标签、手动「已掌握/易忘」标记，
 * 并支持按掌握度区间和标签筛选".
 *
 * These are the learner's OWN decisions, kept apart from the SRS:
 *   starred     — 生词, worth another look (independent of mastery)
 *   mark_state  — 已掌握 / 易忘 / none
 *
 * The custom tags already live in vocabulary_tags (the imported
 * category is stored there), so the theme filter on the list page is
 * the tag filter.
 */

import { useState, useTransition } from "react";
import { setMarkStateAction, setStarAction } from "@/app/vocabulary/actions";

export function VocabStarButton({
  vocabId,
  initialStarred,
}: {
  vocabId: string;
  initialStarred: boolean;
}) {
  const [starred, setStarred] = useState(initialStarred);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !starred;
    setStarred(next);
    startTransition(async () => {
      await setStarAction(vocabId, next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={starred}
      aria-label={starred ? "取消星标" : "加星标（生词）"}
      title={
        starred
          ? "已星标（生词标记）——点一下取消"
          : "加星标，标记为生词"
      }
      className={`p-1 rounded transition-colors text-lg leading-none ${
        starred
          ? "text-amber-500 hover:text-amber-600"
          : "text-gray-300 hover:text-amber-500"
      } ${pending ? "opacity-60" : ""}`}
    >
      <span aria-hidden="true">{starred ? "★" : "☆"}</span>
    </button>
  );
}

export function VocabMarkButtons({
  vocabId,
  initialMarkState,
}: {
  vocabId: string;
  initialMarkState: "mastered" | "weak" | null;
}) {
  const [mark, setMark] = useState(initialMarkState);
  const [pending, startTransition] = useTransition();

  function apply(next: "mastered" | "weak" | null) {
    const value = mark === next ? null : next;
    setMark(value);
    startTransition(async () => {
      await setMarkStateAction(vocabId, value);
    });
  }

  const base =
    "px-2.5 py-1 text-xs rounded-md border transition-colors disabled:opacity-60";
  const mastered =
    mark === "mastered"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : "border-gray-300 text-gray-600 hover:bg-emerald-50";
  const weak =
    mark === "weak"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : "border-gray-300 text-gray-600 hover:bg-amber-50";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => apply("mastered")}
        disabled={pending}
        aria-pressed={mark === "mastered"}
        className={`${base} ${mastered}`}
        title="手动标记「已掌握」"
      >
        {mark === "mastered" ? "✓ 已掌握" : "标记已掌握"}
      </button>
      <button
        type="button"
        onClick={() => apply("weak")}
        disabled={pending}
        aria-pressed={mark === "weak"}
        className={`${base} ${weak}`}
        title="手动标记「易忘」"
      >
        {mark === "weak" ? "✓ 易忘" : "标记易忘"}
      </button>
    </div>
  );
}
