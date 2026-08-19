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
import {
  getDueReviews,
  getUserVocabCount,
  userHasVocabWithExamples,
  getUserReviewRowCount,
} from "@/lib/vocabulary/reviews";
import { backfillUserReviewsAction } from "./actions";
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
  // TEMP DEBUG per Frank #6364: surface how many review rows exist
  // for this user — splits the failure modes with the page debug strip.
  const reviewRowCount = await getUserReviewRowCount();
  // Per Frank #6348 + #6353: drive the empty-state UI from server-side
  // data, not URL search params (the previous ?notice=no_examples flag
  // was getting stripped somewhere in the redirect chain and the page
  // kept showing the stale "还没有复习队列" copy). Three states:
  //   - items.length > 0                       → ReviewSession
  //   - vocabCount === 0                        → no-vocab CTA
  //   - vocabCount > 0 && !userHasAnyExample   → no-examples guidance
  //   - vocabCount > 0 &&  userHasAnyExample   → backfill CTA (edge case)
  let vocabCount = 0;
  let userHasAnyExample = false;
  if (items.length === 0) {
    vocabCount = await getUserVocabCount();
    if (vocabCount > 0) {
      userHasAnyExample = await userHasVocabWithExamples();
    }
  }

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
        vocabCount === 0 ? (
          // Truly empty — user has no vocab items at all.
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
        ) : !userHasAnyExample ? (
          // Per Frank #6353: user has vocab but no item has an example
          // attached, so backfill can't queue anything (getDueReviews
          // filters out items lacking examples). Direct them to
          // /vocabulary to regenerate examples (one click per word —
          // no batch-generate yet, that's Phase 7+ polish).
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">📝</div>
            <p className="text-lg font-medium">单词还没例句</p>
            <p className="text-sm text-gray-500 mt-2">
              你已收藏 <strong>{vocabCount}</strong> 个单词，但都还没生成例句。
              先到单词详情页点"重新生成"按钮给单词加上例句，然后回来再试。
            </p>
            <Link
              href="/vocabulary"
              className="inline-block mt-6 px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              去收藏列表生成例句
            </Link>
            <form action={backfillUserReviewsAction} className="mt-3">
              <button
                type="submit"
                className="text-xs text-gray-400 hover:text-gray-700 underline-offset-2 hover:underline"
              >
                已生成例句？点这里再试 →
              </button>
            </form>
          </div>
        ) : (
          // Vocab exists with examples but the SRS queue is empty.
          // Shouldn't normally happen (ensureReviewRecord + backfill
          // cover the insert path), but the button is the right
          // fallback if some manual delete ever leaves us here.
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">🔄</div>
            <p className="text-lg font-medium">还没有复习队列</p>
            <p className="text-sm text-gray-500 mt-2">
              你已收藏 <strong>{vocabCount}</strong> 个单词，但还没加入复习队列。
              点下方按钮一次性把它们排进今天的复习。
            </p>
            <form action={backfillUserReviewsAction} className="mt-6">
              <button
                type="submit"
                className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                🔄 把已收藏的词加入复习队列
              </button>
            </form>
            <Link
              href="/vocabulary"
              className="inline-block mt-3 text-sm text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
            >
              或先去收藏列表 →
            </Link>
          </div>
        )
      ) : (
        <ReviewSession initialItems={items} mode={mode} />
      )}

      {/* TEMP DEBUG per Frank #6358 — confirm the data-driven branch
          selection actually fires in the browser. Will remove once
          Frank confirms the right UI shows. */}
      <div className="mt-4 text-[10px] text-gray-400 text-center font-mono opacity-60 select-all">
        debug · items={items.length} · vocab={vocabCount} ·
        hasExample={String(userHasAnyExample)} ·
        reviewsInDb={reviewRowCount}
      </div>
    </main>
  );
}
