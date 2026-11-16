"use client";

/**
 * The export buttons.
 *
 * Audit 2026-11-16 P1-9: no export existed at all, so a learner could
 * not move their collection into Anki (which is where spaced
 * repetition really happens) without copy-pasting by hand.
 *
 * The links carry the CURRENT filter, so "导出" exports what is on
 * screen rather than the whole collection. They are plain GET links —
 * the endpoint returns the file, so there is no fetch, no blob and no
 * client-side CSV building.
 */

export type ExportFilters = {
  q?: string;
  type?: string;
  level?: string;
  sort?: string;
  filter?: string;
  tag?: string;
  /** P1-10: the 掌握度区间 bucket, e.g. "20-49". */
  mastery?: string;
};

export function ExportButtons({
  filters = {},
  className = "",
}: {
  filters?: ExportFilters;
  className?: string;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }

  const csvUrl = `/api/export?${params.toString()}&format=csv`;
  const ankiUrl = `/api/export?${params.toString()}&format=anki`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <a
        href={csvUrl}
        download
        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        title="导出为 CSV（含读音、释义、例句、等级）"
      >
        ⬇ 导出 CSV
      </a>
      <a
        href={ankiUrl}
        download
        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        title="导出为 Anki 可导入格式（制表符分隔）"
      >
        ⬇ 导出 Anki
      </a>
    </div>
  );
}
