import Link from "next/link";

export default function TodayPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <header className="mb-12">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← 返回
        </Link>
        <p className="text-sm text-gray-500 mt-4">FastStudy 2.0</p>
        <h1 className="text-3xl font-bold mt-1">今日训练</h1>
        <p className="text-gray-600 mt-2">
          Good evening.{" "}
          <span className="text-gray-400">连续训练 18 天 🔥</span>
        </p>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8">
        <div className="text-sm text-gray-500 mb-2">Today's Goal</div>
        <h2 className="text-2xl font-bold mb-8">约 30 分钟</h2>

        <ul className="space-y-3">
          <li className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50">
            <span className="flex items-center gap-3">
              <span>🎧</span>
              <span>听力</span>
            </span>
            <span className="text-sm text-gray-500">10 分钟</span>
          </li>
          <li className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50">
            <span className="flex items-center gap-3">
              <span>🎤</span>
              <span>口语</span>
            </span>
            <span className="text-sm text-gray-500">10 分钟</span>
          </li>
          <li className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50">
            <span className="flex items-center gap-3">
              <span>🔁</span>
              <span>Shadowing</span>
            </span>
            <span className="text-sm text-gray-500">5 分钟</span>
          </li>
          <li className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50">
            <span className="flex items-center gap-3">
              <span>📝</span>
              <span>复习</span>
            </span>
            <span className="text-sm text-gray-500">5 分钟</span>
          </li>
        </ul>

        <button
          type="button"
          disabled
          className="w-full mt-8 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          开始今天的训练
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">
          Phase 1 完成后即可启用
        </p>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          最近弱点
        </h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50">
            <span>助词 は / が</span>
            <span className="text-gray-400">× 6</span>
          </li>
          <li className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50">
            <span>接続詞</span>
            <span className="text-gray-400">× 4</span>
          </li>
          <li className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50">
            <span>句子连接能力</span>
            <span className="text-gray-400">× 5</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
