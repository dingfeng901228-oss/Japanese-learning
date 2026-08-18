// /vocabulary/[id] — detail page.
//
// Phase 2 basics: type badges, word/reading/meaning, delete.
// Phase 3: auto-attached primary example (sentence/reading/translation).
// Phase 4 lite: "重新生成" button to swap the example for a fresh one.
// Phase 4 full: "编辑" toggle + inline editor (sentence/reading/translation
//   with user_edited=true on save).
// Phase 5 lite: "🔊 朗读" button — Web Speech API TTS, browser-native,
//   zero-cost. Quality varies by browser; OpenAI tts-1 swap-in is
//   straightforward when quality matters more than cost.
// Phase 7+: SRS, today queue, listening mode. Placeholder section below.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPrimaryExample,
  getVocabularyItem,
  type VocabularyType,
} from "@/lib/vocabulary";
import { SpeakButton } from "@/components/SpeakButton";
import {
  deleteVocabularyItemAction,
  regenerateExampleAction,
  updateExampleAction,
} from "../actions";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const editing = sp.edit === "1";

  const item = await getVocabularyItem(id);
  if (!item) notFound();
  const example = await getPrimaryExample(id);

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
        <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">📝 例句</h2>
          <div className="flex items-center gap-4">
            {!editing && example && (
              <Link
                href={`/vocabulary/${id}?edit=1`}
                className="text-xs text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
              >
                编辑
              </Link>
            )}
            <form action={regenerateExampleAction}>
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                className="text-xs text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
              >
                {example ? "重新生成" : "生成例句"}
              </button>
            </form>
          </div>
        </div>

        {editing ? (
          <form action={updateExampleAction} className="space-y-4">
            <input type="hidden" name="vocabulary_id" value={id} />
            <div>
              <label
                htmlFor="ex-sentence"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                日文例句 *
              </label>
              <textarea
                id="ex-sentence"
                name="sentence"
                required
                rows={3}
                defaultValue={example?.sentence ?? ""}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 resize-y"
              />
            </div>
            <div>
              <label
                htmlFor="ex-reading"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                假名读音
              </label>
              <textarea
                id="ex-reading"
                name="reading"
                rows={2}
                defaultValue={example?.reading ?? ""}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 resize-y"
              />
            </div>
            <div>
              <label
                htmlFor="ex-translation"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                中文翻译
              </label>
              <textarea
                id="ex-translation"
                name="translation"
                rows={2}
                defaultValue={example?.translation ?? ""}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 resize-y"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                保存
              </button>
              <Link
                href={`/vocabulary/${id}`}
                className="px-5 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </Link>
            </div>
          </form>
        ) : example ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-lg text-gray-900 break-words">
                {example.sentence}
              </p>
              <div className="flex-shrink-0 -mt-1">
                <SpeakButton text={example.sentence} />
              </div>
            </div>
            {example.reading && (
              <p className="text-sm text-gray-500 break-words">
                {example.reading}
              </p>
            )}
            {example.translation && (
              <p className="text-sm text-gray-600 break-words">
                {example.translation}
              </p>
            )}
            {example.user_edited && (
              <p className="text-xs text-gray-400 italic">已手动编辑</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            还没有例句，点"生成例句"让 AI 生成一个。
          </p>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-8 mb-6">
        <h2 className="text-lg font-semibold mb-3">🔁 复习</h2>
        <p className="text-sm text-gray-500">
          复习功能将在 Phase 7 启用。届时会基于 SRS 间隔复习算法自动安排。
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
