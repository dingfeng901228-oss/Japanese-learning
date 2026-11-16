"use client";

/**
 * KanjiStrokeOrderRow — the 笔顺 block on the vocabulary detail page.
 *
 * Audit 2026-11-16 P0-5. Before:
 *   - the boxes rendered blank and each kanji needed its own "重播"
 *     click before anything was drawn
 *   - the kanji played independently, so a 2-kanji word meant two
 *     separate play buttons
 *
 * Now:
 *   - the whole word plays automatically once, on entry
 *   - the kanji play in sequence (kanji 1 stroke by stroke, then kanji 2)
 *   - a 慢速 toggle halves the speed for the strokes you want to check
 *   - one 重播 button replays the whole word
 *
 * Data: KanjiVG via Tomoshi's open data layer (CC BY-SA 3.0).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { extractKanji, fetchStrokes } from "@/lib/dict/client";
import { KanjiStrokeOrder } from "./KanjiStrokeOrder";

/** ms per stroke at normal speed */
const NORMAL_MS = 380;
/** ms per stroke at slow speed */
const SLOW_MS = 850;

export function KanjiStrokeOrderRow({ word }: { word: string }) {
  const kanjis = useMemo(
    () => Array.from(new Set(extractKanji(word))),
    [word]
  );
  const [pathsByKanji, setPathsByKanji] = useState<
    Record<string, string[]> | null
  >(null);
  // Playhead: how many strokes have been drawn in total, across all
  // kanji. Stroke counts per kanji give the boundaries.
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const startedRef = useRef(false);

  // Load every kanji's strokes in one go (the client groups by shard).
  useEffect(() => {
    if (kanjis.length === 0) {
      setPathsByKanji({});
      return;
    }
    let cancelled = false;
    setPathsByKanji(null);
    setPlayhead(0);
    setPlaying(false);
    startedRef.current = false;
    fetchStrokes(kanjis).then((map) => {
      if (cancelled) return;
      const out: Record<string, string[]> = {};
      for (const k of kanjis) out[k] = map[k] ?? [];
      setPathsByKanji(out);
    });
    return () => {
      cancelled = true;
    };
  }, [kanjis]);

  // The ordered stroke list: [ [kanji, stroke], ... ] flattened.
  const timeline = useMemo(() => {
    if (!pathsByKanji) return [];
    const out: { kanji: string; strokes: string[] }[] = [];
    for (const k of kanjis) {
      const strokes = pathsByKanji[k];
      if (strokes && strokes.length > 0) out.push({ kanji: k, strokes });
    }
    return out;
  }, [pathsByKanji, kanjis]);

  const totalStrokes = useMemo(
    () => timeline.reduce((s, t) => s + t.strokes.length, 0),
    [timeline]
  );

  // Auto-play once, as soon as the strokes arrive.
  useEffect(() => {
    if (!pathsByKanji || startedRef.current) return;
    if (totalStrokes === 0) return;
    startedRef.current = true;
    setPlaying(true);
  }, [pathsByKanji, totalStrokes]);

  // The playhead advances one stroke at a time.
  useEffect(() => {
    if (!playing) return;
    if (playhead >= totalStrokes) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(
      () => setPlayhead((p) => p + 1),
      slow ? SLOW_MS : NORMAL_MS
    );
    return () => clearTimeout(t);
  }, [playing, playhead, totalStrokes, slow]);

  // How many strokes of each kanji are visible at the current playhead.
  const shownByKanji = useMemo(() => {
    const out: Record<string, number> = {};
    let consumed = 0;
    for (const t of timeline) {
      const remaining = Math.max(
        0,
        Math.min(t.strokes.length, playhead - consumed)
      );
      out[t.kanji] = remaining;
      consumed += t.strokes.length;
    }
    return out;
  }, [timeline, playhead]);

  // Which kanji the playhead is on.
  const activeKanji = useMemo(() => {
    let consumed = 0;
    for (const t of timeline) {
      if (playhead < consumed + t.strokes.length) return t.kanji;
      consumed += t.strokes.length;
    }
    return timeline.length > 0 ? timeline[timeline.length - 1].kanji : null;
  }, [timeline, playhead]);

  if (kanjis.length === 0) return null;

  if (!pathsByKanji) {
    return (
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          ✍️ 笔顺
        </h2>
        <p className="text-xs text-gray-400">载入笔顺数据…</p>
      </section>
    );
  }

  if (timeline.length === 0) {
    return (
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          ✍️ 笔顺
        </h2>
        <p className="text-xs text-gray-400">该词条没有笔顺数据。</p>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          ✍️ 笔顺
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPlayhead(0);
              setPlaying(true);
            }}
            className="px-2.5 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            重播
          </button>
          <button
            type="button"
            onClick={() => setSlow((s) => !s)}
            aria-pressed={slow}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
              slow
                ? "border-ink bg-ink text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            慢速
          </button>
          <span className="text-xs text-gray-400 tabular-nums">
            {playhead} / {totalStrokes} 画
          </span>
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        {timeline.map((t) => (
          <KanjiStrokeOrder
            key={t.kanji}
            character={t.kanji}
            paths={t.strokes}
            shown={shownByKanji[t.kanji] ?? 0}
            active={activeKanji === t.kanji}
          />
        ))}
      </div>
    </section>
  );
}
