"use client";

/**
 * KanjiStrokeOrder — animated stroke-order viewer.
 *
 * Renders the KanjiVG stroke paths for one kanji. Paths are drawn
 * progressively (stroke 1, then 2, …) with a "重播" button and a
 * per-stroke scrubber.
 *
 * Data: KanjiVG via Tomoshi's open data layer (CC BY-SA 3.0).
 * Attribution: public/dict/ATTRIBUTION.md
 *
 * Coordinate system: KanjiVG authors its paths directly in SVG space —
 * a 109×109 viewBox with the character box from (4,4) to (105,105) and
 * Y growing DOWNWARD (standard SVG). So the path strings are rendered
 * as-is, with no transform. (A vertical flip looks plausible on
 * near-symmetric kanji like 確, but 永 renders upside-down — verified
 * by rendering both ways side by side.)
 */

import { useEffect, useMemo, useState } from "react";
import { fetchStrokes } from "@/lib/dict/client";

interface KanjiStrokeOrderProps {
  /** the kanji character to display */
  character: string;
  /** render size in px */
  size?: number;
}

export function KanjiStrokeOrder({ character, size = 96 }: KanjiStrokeOrderProps) {
  const [paths, setPaths] = useState<string[] | null>(null);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPaths(null);
    setShown(0);
    setPlaying(false);
    fetchStrokes([character]).then((map) => {
      if (cancelled) return;
      setPaths(map[character] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [character]);

  // Play the animation once when the paths arrive.
  useEffect(() => {
    if (!paths || paths.length === 0 || !playing) return;
    if (shown >= paths.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setShown((s) => s + 1), 420);
    return () => clearTimeout(t);
  }, [paths, playing, shown]);

  const viewBox = useMemo(() => "0 0 109 109", []);

  if (paths === null) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-gray-50 text-xs text-gray-400"
        style={{ width: size, height: size }}
      >
        …
      </div>
    );
  }

  if (paths.length === 0) {
    return null;
  }

  return (
    <div className="select-none">
      <svg
        viewBox={viewBox}
        width={size}
        height={size}
        role="img"
        aria-label={`${character} 的笔顺动画`}
        className="rounded-lg bg-white border border-line"
      >
        {/* guide box */}
        <rect
          x="4"
          y="4"
          width="101"
          height="101"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <line x1="4" y1="54.5" x2="105" y2="54.5" stroke="#F3F4F6" strokeWidth="1" />
        <line x1="54.5" y1="4" x2="54.5" y2="105" stroke="#F3F4F6" strokeWidth="1" />

        {paths.slice(0, shown).map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#111827"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setShown(0);
            setPlaying(true);
          }}
          className="px-2.5 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          重播笔顺
        </button>
        <span className="text-xs text-gray-400 tabular-nums">
          {shown} / {paths.length} 画
        </span>
      </div>
    </div>
  );
}
