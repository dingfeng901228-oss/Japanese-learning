// Phase 0 banner — spec §18. Keep restrained, lots of whitespace.

export function PhaseBanner() {
  return (
    <section className="py-12 border-t border-line">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-4">
        Phase 0 · 2026
      </p>
      <h2 className="font-sc text-2xl font-bold text-ink mb-2">重新开始</h2>
      <ul className="font-jp text-gray-700 space-y-1 mt-4 text-lg">
        <li>日本語を学ぶ。</li>
        <li>日本で働く。</li>
        <li>新しい生活を作る。</li>
      </ul>
    </section>
  );
}
