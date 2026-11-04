/**
 * DictionaryAttribution — required CC BY-SA attribution for the
 * dictionary data used by the lookup widget and the analysis cards.
 *
 * The data comes from Tomoshi's open data layer (JMdict / KANJIDIC2 /
 * KanjiVG derived, plus Tomoshi's own Chinese-language analysis layers).
 * Full licence breakdown: public/dict/ATTRIBUTION.md
 */
export function DictionaryAttribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-gray-400 ${className}`}>
      词典数据来自 JMdict / KANJIDIC2（© EDRDG）与 KanjiVG（© Ulrich
      Apel）；中文释义与辨析内容来自{" "}
      <a
        href="https://github.com/tomoshi-app/tomoshi-dict-data"
        target="_blank"
        rel="noreferrer noopener"
        className="underline hover:text-gray-600"
      >
        Tomoshi
      </a>
      （© Y1Z）。以 CC BY-SA 许可共享。
    </p>
  );
}
