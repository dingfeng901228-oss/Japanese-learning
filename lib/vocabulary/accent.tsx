// Pitch accent (アクセント) formatting.
//
// Audit 2026-11-16 P1-7: the site showed no accent anywhere, so a
// learner could not tell 猫 (①) from 犬 (②) — the two words are
// identical apart from the accent.
//
// The accent number comes from the Kanjium project (CC-BY-SA 4.0) via
// the jkindrix/japanese-language-data enrichment file, and is stored
// per word in vocabulary_items.accent:
//
//   0 = 平板 (heiban, flat — no drop)
//   N > 0 = the pitch falls after the Nth mora
//
// The Japanese convention writes these as circled numbers: ⓪ ① ② ③.

/** The circled digits ⓪①②③…, i.e. 0x2460 is ①. */
const CIRCLED_ONE = 0x2460;

/**
 * Format an accent number the way a Japanese dictionary does.
 *
 * 0 -> ⓪ (平板), 1 -> ①, 2 -> ②, ... 20 -> ⑳.
 * Beyond 20 (never seen in practice) it falls back to plain digits.
 */
export function formatAccent(accent: number | null | undefined): string {
  if (accent === null || accent === undefined) return "";
  if (accent < 0) return "";
  if (accent === 0) return String.fromCodePoint(CIRCLED_ONE - 1);
  if (accent <= 20) return String.fromCodePoint(CIRCLED_ONE + accent - 1);
  return String(accent);
}

/** The name of the accent pattern, for the tooltip. */
export function accentName(accent: number | null | undefined): string {
  if (accent === null || accent === undefined) return "";
  if (accent === 0) return "平板型（無アクセント）";
  if (accent === 1) return "頭高型";
  if (accent >= 2) return "中高型 / 尾高型";
  return "";
}

/**
 * The badge shown when a field could not be filled from the dictionary.
 *
 * P1-7 requires that a missing value is stated, not silently omitted:
 * "补不上的词条在详情页标'声调待补全'，不要静默省略".
 */
export function PendingBadge({ label }: { label: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded border border-dashed border-gray-300 text-gray-400"
      title={`词典数据源没有这个词的${label}，需要手动补充`}
    >
      {label}待补全
    </span>
  );
}
