// /review — today's SRS queue (Phase 7 + Phase 8 lite).
//
// Two review modes (Phase 8):
//   - "fill-in" (default): see the blanked example sentence + meaning
//     hint, type the missing word back.
//   - "dictation": TTS auto-plays the example sentence, the sentence
//     is HIDDEN until after you answer (forces listening, not reading).
//
// Same SM-2 recordReview mechanism for both modes. Mode is a query
// param: /review (fill-in) vs /review?mode=dictation.

import Link from "next/link";
import { getDueReviews } from "@/lib/vocabulary/reviews";
import { ReviewSession, type ReviewMode } from "./review-session";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const sp = await searchParams;
  const mode: ReviewMode = sp.mode === "dictation" ? "dictation" : "fill-in";
  const items = await getDueReviews(20);

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <header className="mb-8">
        <Link
          href="/today"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 返回
        </Link>
        <h1 className="text-3xl font-bold mt-4">🔁 今日复习</h1>
        <p className="text-gray-600 mt-2">
          {mode === "dictation"
            ? "听例句，写出听到的单词。按 Enter 检查。"
            : "用例句挖空来考自己。输入单词，按 Enter 检查。"}
        </p>
        <nav className="flex gap-2 mt-4">
          <Link
            href="/review"
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              mode === "fill-in"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            填空
          </Link>
          <Link
            href="/review?mode=dictation"
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              mode === "dictation"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            🎧 听写
          </Link>
        </nav>
      </header>

      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <p className="text-lg font-medium">今日复习完成</p>
          <p className="text-sm text-gray-500 mt-2">
            没有需要复习的单词。收藏新词或等 SRS 把之前的词排到今天。
          </p>
          <Link
            href="/vocabulary"
            className="inline-block mt-6 px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            去收藏新词
          </Link>
        </div>
      ) : (
        <ReviewSession initialItems={items} mode={mode} />
      )}
    </main>
  );
}
