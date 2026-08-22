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
// Phase 1.7: top word card now also has "🔊 朗读" + "编辑" + inline
//   editor (headword / reading / meaning / level / part of speech),
//   controlled by ?edit_word=1 — separate from the example editor
//   (?edit=1) so the two can be edited independently.
// Phase 7+ (#6334): prev / next word preview (see <section> below).
// Phase 7 review placeholder was removed per Frank #6346 — the section
// and the "复习功能将在 Phase 7 启用..." copy are gone. Re-add when
// actual SRS review lands in Phase 7.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPrimaryExample,
  getVocabularyItem,
  listVocabularyItems,
  type VocabularyType,
} from "@/lib/vocabulary";
import { SpeakButton } from "@/components/SpeakButton";
import { WordCardSwipeable } from "./WordCardSwipeable";
import { VocabSessionTimer } from "@/components/vocabulary/VocabSessionTimer";
import {
  deleteVocabularyItemAction,
  regenerateExampleAction,
  updateExampleAction,
  updateWordAction,
} from "../actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<VocabularyType, string> = {
  word: "单词",
  phrase: "词组",
  grammar: "文法",
  sentence: "句型",
};

const JLPT_OPTIONS = ["", "N5", "N4", "N3", "N2", "N1"] as const;

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
  searchParams: Promise<{ edit?: string; edit_word?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const editing = sp.edit === "1";
  const editingWord = sp.edit_word === "1";

  const item = await getVocabularyItem(id);
  if (!item) notFound();
  const example = await getPrimaryExample(id);

  // Phase 7+ (#6334): fetch the full list to compute prev/next neighbours.
  // Default sort matches the /vocabulary list page (newest first) so the
  // “up/down/left/right” order feels consistent with where the user
  // came from. For very large vocabularies this scan gets expensive, but
  // the SELECT only reads (date, word, reading, meaning) — still a single
  // small round-trip. If/when the catalog grows past a few hundred
  // items, swap to a server action that precomputes neighbours on save.
  const allItems = await listVocabularyItems({});
  const currentIndex = allItems.findIndex((x) => x.id === item.id);
  const prevItem =
    currentIndex > 0 ? allItems[currentIndex - 1] : null;
  const nextItem =
    currentIndex >= 0 && currentIndex < allItems.length - 1
      ? allItems[currentIndex + 1]
      : null;

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <header className="mb-8">
        {/* Per Frank #6576: put "+手动添加" on the same row as
            "← 返回收藏列表", at the far right. Using flex justify-between
            so the back link sits on the left and the styled button sits
            on the right of the header row. Same styled button treatment
            as the list page's "+手动添加" (commit 4123f74 + fddb30a) and
            the previous detail-page commit 29a3a28 — consistent
            affordance across pages. */}
        <div className="flex items-center justify-between">
          <Link
            href="/vocabulary"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← 返回收藏列表
          </Link>
          <div className="flex items-center gap-3">
            {/* Per Frank #6671 (UI优化.docx § 12): vocab 详情页加
                5s/word 计时器。segmentKey=item.id — user 翻下个词时
                useSessionTimer 自动重置 segment，计时器重新走 5s。
                "vocab" bucket 跟 /review 共用（UI优化.docx § 9），所
                以这里的时间和复习页时间都进 词汇 daily_rollups。 */}
            <VocabSessionTimer vocabId={item.id} />
            <Link
              href="/vocabulary/new"
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              + 手动添加
            </Link>
          </div>
        </div>
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

      {/* Per Frank #6576: removed the standalone toolbar div (29a3a28)
          that put "+手动添加" between the header and the article card.
          The button now lives in the header (see top of this <header>)
          on the same row as "← 返回收藏列表", so no standalone
          toolbar block is needed here. */}

      {/* Per Frank #6610 + #6620: WordCardSwipeable now wraps BOTH the
         word card (<article>) AND the example section (<section>) so a
         swipe gesture anywhere in the upper content area triggers
         prev/next navigation with the page-turn animation. The bottom
         "切换单词" preview grid + the "取消收藏" form stay outside the
         wrapper so vertical scrolling and clicks on those stay normal.

         `disabled` ORs both editing flags — if either form is open
         (word editing via ?edit_word=1, example editing via ?edit=1),
         swipe is suppressed so the user can't be yanked out of a form
         they're filling in. */}
      <WordCardSwipeable
        prevId={prevItem?.id ?? null}
        nextId={nextItem?.id ?? null}
        disabled={editingWord || editing}
      >
        <article className="bg-white border border-gray-200 rounded-2xl p-8 mb-6">
        {editingWord ? (
          <form action={updateWordAction} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <div className="flex items-start justify-between gap-3">
              <label
                htmlFor="word-word"
                className="block text-sm font-medium text-gray-700 mb-1 flex-1"
              >
                单词 / 词组 *
              </label>
            </div>
            <input
              id="word-word"
              type="text"
              name="word"
              required
              defaultValue={item.word}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
            />

            <div>
              <label
                htmlFor="word-reading"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                假名 / 读音
              </label>
              <input
                id="word-reading"
                type="text"
                name="reading"
                defaultValue={item.reading ?? ""}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
                placeholder="例：みにつける"
              />
            </div>

            <div>
              <label
                htmlFor="word-meaning"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                中文意思 *
              </label>
              <input
                id="word-meaning"
                type="text"
                name="meaning"
                required
                defaultValue={item.meaning}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="word-level"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  JLPT 等级
                </label>
                <select
                  id="word-level"
                  name="level"
                  defaultValue={item.level ?? ""}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
                >
                  {JLPT_OPTIONS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl === "" ? "不指定" : lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="word-pos"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  词性
                </label>
                <input
                  id="word-pos"
                  type="text"
                  name="part_of_speech"
                  defaultValue={item.part_of_speech ?? ""}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
                  placeholder="例：他动词"
                />
              </div>
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
        ) : (
          <>
            <div className="flex items-start gap-3 mb-2">
              <h1 className="flex-1 text-4xl font-bold break-words">
                {item.word}
              </h1>
              <div className="flex items-center gap-2 flex-shrink-0">
                <SpeakButton text={item.word} />
                <Link
                  href={`/vocabulary/${id}?edit_word=1`}
                  className="text-xs text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
                >
                  编辑
                </Link>
              </div>
            </div>
            {item.reading && (
              <p className="text-lg text-gray-500 mb-4">{item.reading}</p>
            )}
            <p className="text-xl text-gray-800 mb-6">{item.meaning}</p>

            <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-gray-400 pt-4 border-t border-gray-100">
              <span>
                收藏于 {formatDateTime(item.created_at)}
              </span>

              {/* Source block (per docs/0821requirements.docx §22 + §28) —
                  only shown for items inserted via Chrome extension.
                  Per Frank #6625: keep only 来源 Chrome 扩展 · 查看原文
                  (drop the date, site title, and domain), and place it
                  on the same row as 收藏于, pushed to the right. */}
              {item.source === "chrome-extension" && (
                <span className="flex items-center gap-1.5 text-gray-600 flex-shrink-0">
                  <span className="font-medium text-gray-700">
                    来源
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                    Chrome 扩展
                  </span>
                  {item.source_url && (
                    <>
                      <span className="text-gray-400">·</span>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
                      >
                        查看原文 ↗
                      </a>
                    </>
                  )}
                </span>
              )}
            </div>
          </>
        )}
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
      </WordCardSwipeable>

      {/* Phase 7+ (#6334): prev / next word preview. Click either card to
         jump to that word's detail page — no need to go back to the
         list first. Each card shows a tiny preview (word + reading +
         meaning) so the user can decide at a glance whether to jump.
         If currentIndex is -1 (item not in list, shouldn't happen) or at
         the boundary, the missing side is hidden. */}
      {(prevItem || nextItem) && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            切换单词
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {prevItem ? (
              <Link
                href={`/vocabulary/${prevItem.id}`}
                className="block p-4 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors group"
              >
                <div className="text-xs text-gray-500 mb-1 group-hover:text-gray-700">
                  ← 上一个词
                </div>
                <div className="text-lg font-bold text-ink break-words">
                  {prevItem.word}
                </div>
                {prevItem.reading && (
                  <div className="text-sm text-gray-500 mt-0.5">
                    {prevItem.reading}
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {prevItem.meaning}
                </div>
              </Link>
            ) : (
              <div /> /* keeps the grid 2-col when only "next" exists */
            )}
            {nextItem ? (
              <Link
                href={`/vocabulary/${nextItem.id}`}
                className="block p-4 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors group text-right"
              >
                <div className="text-xs text-gray-500 mb-1 group-hover:text-gray-700">
                  下一个词 →
                </div>
                <div className="text-lg font-bold text-ink break-words">
                  {nextItem.word}
                </div>
                {nextItem.reading && (
                  <div className="text-sm text-gray-500 mt-0.5">
                    {nextItem.reading}
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                  {nextItem.meaning}
                </div>
              </Link>
            ) : (
              <div />
            )}
          </div>
        </section>
      )}

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
