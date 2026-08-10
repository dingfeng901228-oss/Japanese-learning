import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-2xl text-center">
        <p className="text-sm text-gray-500 mb-4">FastStudy 2.0</p>
        <h1 className="text-5xl font-bold mb-6">Don't just study Japanese.</h1>
        <p className="text-2xl text-gray-700 mb-12">Use Japanese.</p>
        <p className="text-base text-gray-600 mb-12 max-w-xl mx-auto">
          AI 驱动的日语口语教练。长期观察学习者，自动调整训练内容，
          把"看得懂的日语"逐渐变成"听得懂、说得出、用得自然的日语"。
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/today"
            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            今日训练 →
          </Link>
        </div>
        <p className="mt-16 text-xs text-gray-400">Phase 0 骨架 · 2026</p>
      </div>
    </main>
  );
}
