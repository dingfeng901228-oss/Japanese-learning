// /vocabulary/[id] — detail page (Phase 2: basics only).
// Examples + reviews + TTS come in Phase 3+.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getVocabularyItem, type VocabularyType } from "@/lib/vocabulary";
import { deleteVocabularyItemAction } from "../actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<VocabularyType, string> = {
  word: "单词",
  phrase: "词组",
  grammar: "文法",
  sentence: "句型",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function VocabularyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getVocabularyItem(id);
  if (!item) notFound();

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <header className="mb-8">
        <Link
          href="/vocabulary"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 返回收藏列表
        </Link>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            {TYPE_LABEL[item.type]}
          </span>
          {item.level && (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">
              {item.level}
            </span>
          )}
          {item.part_of_speech && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {item.part_of_speech}
            </span>
          )}
        </div>
      </header>

      <article className="bg-white border border-gray-200 rounded-2xl p-8 mb-6">
        <h1 className="text-4xl font-bold mb-2 break-words">{item.word}</h1>
        {item.reading && (
          <p className="text-lg text-gray-500 mb-4">{item.reading}</p>
        )}
        <p className="text-xl text-gray-800 mb-6">{item.meaning}</p>

        <div className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          收藏于 {formatDateTime(item.created_at)}
        </div>
      </article>

      <section className="bg-white border border-gray-200 rounded-2xl p-8 mb-6">
        <h2 className="text-lg font-semibold mb-3">📝 例句</h2>
        <p className="text-sm text-gray-500">
          例句功能将在 Phase 3 启用。届时收藏后 AI 会自动生成多个常用例句。
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-8 mb-6">
        <h2 className="text-lg font-semibold mb-3">🔁 复习</h2>
        <p className="text-sm text-gray-500">
          复习功能将在 Phase 5 启用。届时会基于 SRS 间隔复习算法自动安排。
        </p>
      </section>

      <form action={deleteVocabularyItemAction} className="pt-4">
        <input type="hidden" name="id" value={item.id} />
        <button
          type="submit"
          className="text-sm text-red-500 hover:text-red-700"
        >
          取消收藏
        </button>
      </form>
    </main>
  );
}
