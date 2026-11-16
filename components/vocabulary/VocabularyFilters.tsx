"use client";

/**
 * The filter row on /vocabulary.
 *
 * Audit 2026-11-16 P1-12: "筛选/排序下拉改动后自动应用（现在必须再点
 * 「搜索」）". Before, every dropdown change needed a second click.
 *
 * This has to be a Client Component: a Server Component cannot pass an
 * event handler to a DOM element — Next.js throws "Event handlers
 * cannot be passed to Client Component props" and the page 500s. The
 * selects submit the form themselves; the search box still needs the
 * button (or Enter).
 */

import type { VocabularyType } from "@/lib/vocabulary";
import {
  JLPT_LEVELS,
  MASTERY_RANGES,
  SORT_OPTIONS,
  STATE_FILTER_OPTIONS,
  TYPE_LABEL,
} from "@/lib/vocabulary/filters";

function autoApply(e: React.ChangeEvent<HTMLSelectElement>) {
  const form = (e.target as HTMLSelectElement).form;
  if (form) form.requestSubmit();
}

export type VocabularyFilterProps = {
  q: string;
  type: string;
  level: string;
  filter: string;
  mastery: string;
  tag: string;
  sort: string;
  /** The types the user actually has, with their counts (P1-13). */
  typeCounts: Record<string, number>;
  /** The themes in the collection, with their counts (P1-11). */
  tags: { tag: string; count: number }[];
};

export function VocabularyFilters(props: VocabularyFilterProps) {
  const { q, type, level, filter, mastery, tag, sort, typeCounts, tags } =
    props;

  const availableTypes = (Object.keys(TYPE_LABEL) as VocabularyType[]).filter(
    (ty) => (typeCounts[ty] ?? 0) > 0
  );

  return (
    <form
      method="get"
      action="/vocabulary"
      className="mb-8 flex gap-2 flex-wrap"
    >
      <input
        type="text"
        name="q"
        defaultValue={q}
        placeholder="搜索 单词 / 假名 / 中文..."
        className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
      />
      {/* P1-13: only the types the user actually has. 文法 / 句型 were
          dead options — Frank's collection has 3,254 words, 93 phrases
          and zero of either. */}
      <select
        name="type"
        defaultValue={type}
        onChange={autoApply}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
      >
        <option value="">全部类型</option>
        {availableTypes.map((ty) => (
          <option key={ty} value={ty}>
            {TYPE_LABEL[ty]} ({typeCounts[ty]})
          </option>
        ))}
      </select>
      <select
        name="level"
        defaultValue={level}
        onChange={autoApply}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
      >
        <option value="">全部等级</option>
        {JLPT_LEVELS.map((lvl) => (
          <option key={lvl} value={lvl}>
            {lvl}
          </option>
        ))}
      </select>
      {/* P1-6 / P1-10: the 状态 filter. */}
      <select
        name="filter"
        defaultValue={filter}
        onChange={autoApply}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
      >
        {STATE_FILTER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {/* P1-10: 掌握度区间 */}
      <select
        name="mastery"
        defaultValue={mastery}
        onChange={autoApply}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
      >
        {MASTERY_RANGES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {/* P1-11: 主题 — the category the imported word came from. */}
      {tags.length > 0 && (
        <select
          name="tag"
          defaultValue={tag}
          onChange={autoApply}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white max-w-[220px]"
        >
          <option value="">全部主题</option>
          {tags.map((tg) => (
            <option key={tg.tag} value={tg.tag}>
              {tg.tag} ({tg.count})
            </option>
          ))}
        </select>
      )}
      <select
        name="sort"
        defaultValue={sort}
        onChange={autoApply}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
      >
        搜索
      </button>
      <noscript>
        <span className="text-xs text-gray-500">
          筛选已自动应用；搜索框需要点「搜索」。
        </span>
      </noscript>
    </form>
  );
}
