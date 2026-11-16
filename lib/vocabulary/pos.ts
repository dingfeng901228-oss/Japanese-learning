// The dictionary's part-of-speech labels, in Chinese.
//
// Audit 2026-11-16 P1-7: the bulk import left part_of_speech empty on
// 2,963 of 3,346 words, and the detail page renders that field
// verbatim — so an English "transitive verb" sitting next to a Chinese
// "动词" (from the AI path) looks broken.
//
// The map lives in pos.json so the TypeScript side and the Python
// backfill script read the SAME table — one mapping, no drift.
//
// Returns "" for anything unrecognised: an empty field lets the AI
// enrichment fill in a Chinese label, which beats storing English.

import posLabels from "./pos.json";

export const POS_LABELS: Record<string, string> = posLabels as Record<
  string,
  string
>;

/**
 * Map a dictionary part-of-speech string to its Chinese label.
 * Unknown values return "" (not the English original).
 */
export function mapPos(raw: string | null | undefined): string {
  if (!raw) return "";
  const key = raw.trim();
  if (!key) return "";
  if (POS_LABELS[key]) return POS_LABELS[key];

  // "noun, used as a suffix" / "verb, ichidan" — try the head word.
  const head = key.split(",")[0].trim();
  if (POS_LABELS[head]) return POS_LABELS[head];

  // "adjective (keiyōshi)" -> "adjective"
  const paren = head.split("(")[0].trim();
  if (POS_LABELS[paren]) return POS_LABELS[paren];

  // Last resort: match on the English POS words themselves. JMdict
  // writes ~600 of Frank's words in a verbose form the table above
  // does not list — "Ichidan verb", "Godan verb with 'ru' ending",
  // "adjectival nouns or quasi-adjectives" — and those are still
  // perfectly ordinary parts of speech.
  const low = key.toLowerCase();
  if (/adjectiv/.test(low)) return "形容词";
  if (/adverb/.test(low)) return "副词";
  if (/verb/.test(low)) return "动词";
  if (/noun/.test(low)) return "名词";
  if (/particle/.test(low)) return "助词";
  if (/pronoun/.test(low)) return "代词";
  if (/numeral|counter/.test(low)) return "数词";
  if (/interjection/.test(low)) return "表达";
  if (/expression/.test(low)) return "表达";
  if (/phrase|idiom|proverb|conjunction|set phrase/.test(low)) return "词组";
  return "";
}
