/**
 * Renders an example sentence with per-character ruby.
 *
 * Audit 2026-11-16 P1-8: "注音从'整句一行平假名'改为逐字 ruby 注音".
 * The furigana used to be one flat kana line under the whole sentence,
 * which tells a learner nothing about WHICH kanji a given reading
 * belongs to — わし could be 和紙 or 和氏 or 塩氏.
 *
 * The segmentation is computed once, offline, by
 * scripts/rebuild-example-furigana.py and stored in
 * vocabulary_examples.furigana as [{text, ruby}]. A segment with a
 * null ruby is already kana, so it needs no <ruby> tag.
 *
 * When there is no segmentation (the sentence could not be matched
 * against the dictionary), the plain text is rendered unchanged — the
 * old behaviour, not a blank.
 */

export type FuriganaSegment = {
  text: string;
  ruby: string | null;
};

export function RubyText({
  segments,
  fallback,
  className = "",
  highlight,
}: {
  segments?: FuriganaSegment[] | null;
  fallback?: string | null;
  className?: string;
  /** A word to emphasise — the review target (the old bolding). */
  highlight?: string | null;
}) {
  if (!segments || segments.length === 0) {
    if (!highlight) {
      return <span className={className}>{fallback ?? null}</span>;
    }
    return (
      <span className={className}>{highlightText(fallback ?? "", highlight)}</span>
    );
  }

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        const body = seg.ruby ? (
          <ruby>
            {seg.text}
            <rp>（</rp>
            <rt>{seg.ruby}</rt>
            <rp>）</rp>
          </ruby>
        ) : (
          <span>{seg.text}</span>
        );
        return (
          <span key={i}>
            {highlight ? highlightText(seg.text, highlight, body) : body}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Wrap the highlighted word in <strong>.
 *
 * The review page used to bold the target word inside the sentence
 * (renderWithBoldTarget). With the ruby segments the sentence is
 * split up, so the bolding has to be applied per segment.
 */
function highlightText(
  text: string,
  highlight: string,
  body?: React.ReactNode
) {
  if (!highlight || !text.includes(highlight)) {
    return body ?? text;
  }
  const idx = text.indexOf(highlight);
  const before = text.slice(0, idx);
  const after = text.slice(idx + highlight.length);
  return (
    <>
      {before}
      <strong className="font-bold text-gray-900">{highlight}</strong>
      {after}
    </>
  );
}
