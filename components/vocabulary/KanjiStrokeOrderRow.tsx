"use client";

/**
 * KanjiStrokeOrderRow — shows a stroke-order viewer for each kanji in a
 * word, side by side.
 *
 * The kanji are extracted client-side (the word can contain kana, latin
 * and punctuation, none of which have stroke data), so we only render
 * the widgets for characters that actually have a kanji entry.
 *
 * Data: KanjiVG via Tomoshi's open data layer (CC BY-SA 3.0).
 */

import { useMemo } from "react";
import { extractKanji } from "@/lib/dict/client";
import { KanjiStrokeOrder } from "./KanjiStrokeOrder";

export function KanjiStrokeOrderRow({ word }: { word: string }) {
  const kanjis = useMemo(() => {
    const list = extractKanji(word);
    // De-duplicate while preserving order.
    return Array.from(new Set(list));
  }, [word]);

  if (kanjis.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        ✍️ 笔顺
      </h2>
      <div className="flex gap-4 flex-wrap">
        {kanjis.map((k) => (
          <KanjiStrokeOrder key={k} character={k} />
        ))}
      </div>
    </section>
  );
}
