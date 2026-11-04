"use client";

/**
 * DictLookupInput — instant dictionary lookup for /vocabulary/new.
 *
 * Before this, adding a word meant: type it → submit → wait 1-3 s for
 * gpt-4o-mini to fill in reading / meaning / level / POS → land on the
 * detail page and hope the AI got it right.
 *
 * Now the form does a prefix lookup against a 30k-word JMdict-derived
 * index (public/dict/lookup.json) as you type. The result appears
 * instantly, with:
 *
 *   - the canonical reading (not an AI guess)
 *   - the Chinese gloss (from JMdict, translated — not an AI guess)
 *   - the part of speech
 *   - the JLPT level (community data, not an AI guess)
 *   - a frequency hint (常用 / 次常用 / 少用)
 *   - a Chinese example sentence
 *
 * "用这个" copies the values into the hidden form fields so the server
 * action stores dictionary-accurate data. If the word isn't in the
 * index, the form silently falls back to the old AI path — nothing is
 * worse than before.
 *
 * Data: Tomoshi open data layer (JMdict derived, CC BY-SA). Attribution
 * is rendered by <DictionaryAttribution /> at the bottom of the form.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadLookup,
  searchLookup,
  type LookupEntry,
  type LookupMap,
} from "@/lib/dict/client";

interface DictLookupInputProps {
  /** the controlled value of the `word` form field */
  value: string;
  onChange: (value: string) => void;
  /** hidden form fields the widget fills in */
  onPick: (fields: {
    reading: string;
    meaning: string;
    level: string;
    partOfSpeech: string;
    example: string;
  }) => void;
  /** input placeholder, varies by type (word / phrase / grammar / sentence) */
  placeholder?: string;
  /** input id, so <label htmlFor> keeps working */
  id?: string;
}

const POS_LABELS: Record<string, string> = {
  noun: "名词",
  "noun (common)": "名词",
  verb: "动词",
  "transitive verb": "他动词",
  "intransitive verb": "自动词",
  adjective: "形容词",
  adverb: "副词",
  particle: "助词",
  pronoun: "代词",
  numeral: "数词",
  expression: "惯用表达",
  "nouns which take the aux. verb suru": "サ变名词",
};

function posLabel(pos: string): string {
  if (!pos) return "";
  return POS_LABELS[pos] ?? POS_LABELS[pos.split(" (")[0]] ?? pos;
}

/** Frequency band from the JMdict frequency rank. */
function freqLabel(rank: number): string {
  if (!rank) return "";
  if (rank <= 2000) return "常用";
  if (rank <= 10000) return "次常用";
  return "少用";
}

export function DictLookupInput({
  value,
  onChange,
  onPick,
  placeholder,
  id,
}: DictLookupInputProps) {
  const [map, setMap] = useState<LookupMap | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Load the 4 MB index lazily — only after the user actually types, so
  // the page's first paint stays light.
  useEffect(() => {
    if (!value.trim() || map) return;
    let cancelled = false;
    setLoading(true);
    loadLookup()
      .then((m) => {
        if (!cancelled && m) setMap(m);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value, map]);

  const results = useMemo(() => {
    if (!map || value.trim().length === 0) return [];
    return searchLookup(map, value);
  }, [map, value]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = useCallback(
    (word: string, entry: LookupEntry) => {
      onPick({
        reading: entry.r,
        meaning: entry.m,
        level: entry.l,
        partOfSpeech: entry.p,
        example: entry.e,
      });
      onChange(word);
      setOpen(false);
      setActiveIndex(-1);
    },
    [onChange, onPick]
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const [w, entry] = results[activeIndex];
      pick(w, entry);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        type="text"
        name="word"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="dict-lookup-listbox"
        aria-autocomplete="list"
      />

      {loading && !map && (
        <p className="text-xs text-gray-400 mt-1.5">载入词典…</p>
      )}

      {open && results.length > 0 && (
        <ul
          id="dict-lookup-listbox"
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-[22rem] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1"
        >
          {results.map(([word, entry], i) => (
            <li key={word} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pick(word, entry)}
                className={`w-full text-left px-4 py-2.5 transition-colors ${
                  i === activeIndex ? "bg-gray-50" : ""
                }`}
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-jp text-base font-semibold text-gray-900">
                    {word}
                  </span>
                  <span className="font-jp text-sm text-gray-500">
                    {entry.r}
                  </span>
                  {entry.l && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                      {entry.l}
                    </span>
                  )}
                  {entry.p && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {posLabel(entry.p)}
                    </span>
                  )}
                  {freqLabel(entry.f) && (
                    <span className="text-[11px] text-gray-400">
                      {freqLabel(entry.f)}
                    </span>
                  )}
                </div>
                {entry.m && (
                  <div className="text-sm text-gray-700 mt-0.5 line-clamp-2">
                    {entry.m}
                  </div>
                )}
                {entry.e && (
                  <div className="text-xs text-gray-500 mt-1 border-l-2 border-line pl-2">
                    <span className="text-gray-400">用法 · </span>
                    {entry.e}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && map && value.trim() && results.length === 0 && !loading && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-500">
          词典未收录「{value.trim()}」，保存时由 AI 自动补全。
        </div>
      )}
    </div>
  );
}
