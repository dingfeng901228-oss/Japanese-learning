// /review — today's SRS queue (Phase 7 + Phase 8 lite).
//
// Server Component fetches up to 20 due reviews from Supabase and hands
// them to the Client Component (review-session.tsx) for the fill-in
// interaction. If the queue is empty, show a friendly "nothing due"
// message + a link to /vocabulary so the user can keep adding.

import Link from "next/link";
import { getDueReviews } from "@/lib/vocabulary/reviews";
import { ReviewSession } from "./review-session";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
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
          用例句挖空来考自己。输入单词，按 Enter 检查。
        </p>
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
        <ReviewSession initialItems={items} />
      )}
    </main>
  );
}
