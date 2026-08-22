// /review — today's SRS queue (single recall flow per docs/review.docx).
//
// Frank #6663 redesign replaces the old fill-in (4 multiple-choice) +
// dictation (TTS-only) two-mode UI with one state machine (full spec
// in docs/review.docx):
//   - QUIZ: target word blanked, full reading + Chinese + 🔊 + 显示单词
//   - ANSWER_REVEALED: full sentence (target bolded) + reading + Chinese +
//     🔊 + [再来一次] [记住了]
//
// Rating simplified from easy/medium/hard → remembered/again (SM-2
// quality 5 / 2). Mode URL param `?mode=dictation` is still accepted
// for backward compat but ignored — both old routes now serve the new
// single flow.

import Link from "next/link";
import {
  getDueReviews,
  getUserVocabCount,
  userHasVocabWithExamples,
} from "@/lib/vocabulary/reviews";
import { backfillUserReviewsAction } from "./actions";
import { ReviewSession } from "./review-session";

export const dynamic = "force-dynamic";

// Frank #6663: dropped the generateDistractors batched LLM call — no
// more multiple-choice, so no distractors needed. Removed the 60s
// maxDuration override too (back to Vercel default 10s, plenty for the
// new pure-data page that only awaits getDueReviews + 2 cheap counts).

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  // Accept ?mode=dictation for backward compat (old bookmarks) but
  // ignore it — single flow serves both old fill-in + dictation routes.
  await searchParams;
  const items = await getDueReviews(20);
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
          看到日语句子（目标词隐藏） + 完整读音 + 中文，主动回忆目标日语文字。
          点「显示单词」检查，记住了就下次再来，没记住马上复习。
        </p>
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
        <ReviewSession initialItems={items} />
      )}
    </main>
  );
}
