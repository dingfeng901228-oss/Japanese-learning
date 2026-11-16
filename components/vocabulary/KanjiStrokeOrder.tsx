"use client";

/**
 * KanjiStrokeOrder — one kanji box, drawn progressively.
 *
 * Presentational: the parent (KanjiStrokeOrderRow) owns the playhead and
 * decides how many strokes of this kanji are visible, so all the kanji
 * of a word can be animated in one continuous sequence.
 *
 * Audit 2026-11-16 P0-5: this used to own its own timer, so every kanji
 * needed its own "重播" click and the box sat blank until then.
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

export function KanjiStrokeOrder({
  character,
  paths,
  shown,
  size = 96,
  active = false,
}: {
  character: string;
  /** stroke paths for this kanji */
  paths: string[];
  /** how many strokes to draw */
  shown: number;
  /** render size in px */
  size?: number;
  /** highlight the kanji the playhead is currently on */
  active?: boolean;
}) {
  if (paths.length === 0) return null;

  return (
    <div className="select-none text-center">
      <svg
        viewBox="0 0 109 109"
        width={size}
        height={size}
        role="img"
        aria-label={`${character} 的笔顺动画`}
        className={`rounded-lg bg-white border ${
          active ? "border-ink" : "border-line"
        }`}
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
      <p className="text-[11px] text-gray-400 mt-1">
        {character}
        <span className="tabular-nums ml-1">
          {shown}/{paths.length}
        </span>
      </p>
    </div>
  );
}
