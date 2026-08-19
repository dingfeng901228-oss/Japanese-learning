// /vocabulary — My Collection list page.
// Server Component that reads searchParams (q / type / sort) and renders
// the user's vocabulary_items via lib/vocabulary.ts.

import Link from "next/link";
import {
  listVocabularyItems,
  type VocabularyType,
  type VocabularySort,
} from "@/lib/vocabulary";
import { batchGenerateExamplesAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  type?: string;
  level?: string;
  sort?: string;
  batch?: string; // "10-5-7" = generated-skipped-errors, set by batchGenerateExamplesAction
};

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

function asType(v: string | undefined): VocabularyType | undefined {
  if (v === "word" || v === "phrase" || v === "grammar" || v === "sentence") {
    return v;
  }
  return undefined;
}

function asLevel(
  v: string | undefined
): (typeof JLPT_LEVELS)[number] | undefined {
  if (v && (JLPT_LEVELS as readonly string[]).includes(v)) {
    return v as (typeof JLPT_LEVELS)[number];
  }
  return undefined;
}

function asSort(v: string | undefined): VocabularySort {
  if (v === "oldest" || v === "word") return v;
  return "newest";
}

const TYPE_LABEL: Record<VocabularyType, string> = {
  word: "单词",
  phrase: "词组",
  grammar: "文法",
  sentence: "句型",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Per Frank #6367: parse the `batch=G-S-E` query param set by
// batchGenerateExamplesAction into a summary banner.
type BatchResult = {
  generated: number;
  skipped: number;
  errors: number;
};
function parseBatchResult(s: string | undefined): BatchResult | null {
  if (!s) return null;
  const parts = s.split("-");
  if (parts.length !== 3) return null;
  const g = Number(parts[0]);
  const sk = Number(parts[1]);
  const e = Number(parts[2]);
  if (!Number.isFinite(g) || !Number.isFinite(sk) || !Number.isFinite(e)) {
    return null;
  }
  return { generated: g, skipped: sk, errors: e };
}

export default async function VocabularyListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const type = asType(sp.type);
  const level = asLevel(sp.level);
  const sort = asSort(sp.sort);
  const batch = parseBatchResult(sp.batch);

  const items = await listVocabularyItems({
    search: q || undefined,
    type,
    level,
    sort,
  });

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/today"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← 返回
          </Link>
          <Link
            href="/vocabulary/new"
            className="text-sm text-gray-700 hover:text-gray-900 ml-auto px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            + 手动添加
          </Link>
        </div>
        <h1 className="text-3xl font-bold mt-2">我的收藏</h1>
        <p className="text-gray-600 mt-2">
          {items.length === 0
            ? q || type
              ? "没有匹配的收藏"
              : "还没有收藏，先添加一个吧"
            : `共 ${items.length} 项`}
        </p>
      </header>

      {/* Per Frank #6367: batch-generate banner — shows the result of
          the most recent batchGenerateExamplesAction call. Three
          variants: success (generated>0), skipped-only (nothing to
          do), error-fetch. */}
      {batch && (
        <div
          className={`mb-6 px-4 py-3 rounded-xl border text-sm ${
            batch.generated > 0
              ? "bg-green-50 border-green-200 text-green-800"
              : batch.errors > 0
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-gray-50 border-gray-200 text-gray-700"
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="font-medium mb-1">
            {batch.errors > 0 && batch.generated === 0
              ? "批量生成失败"
              : batch.generated > 0
                ? "批量生成完成"
                : "没有需要生成例句的单词"}
          </div>
          <div className="text-xs opacity-80">
            新生成 <strong>{batch.generated}</strong> 个 · 已存在{" "}
            <strong>{batch.skipped}</strong> 个 · 失败 <strong>{batch.errors}</strong> 个
          </div>
        </div>
      )}

      {/* Per Frank #6367: batch-generate button. Server Action calls
          generateExample() for every vocab without a primary example,
          inserts results, redirects back with batch=G-S-E summary. */}
      <form action={batchGenerateExamplesAction} className="mb-4">
        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
        >
          🪄 一键生成所有缺失例句
        </button>
      </form>

      <form method="get" className="mb-8 flex gap-2 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="搜索 单词 / 假名 / 中文..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
        />
        <select
          name="type"
          defaultValue={type ?? ""}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
        >
          <option value="">全部类型</option>
          <option value="word">单词</option>
          <option value="phrase">词组</option>
          <option value="grammar">文法</option>
          <option value="sentence">句型</option>
        </select>
        <select
          name="level"
          defaultValue={level ?? ""}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
        >
          <option value="">全部等级</option>
          {JLPT_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
        >
          <option value="newest">最新收藏</option>
          <option value="oldest">最早收藏</option>
          <option value="word">按 A-Z</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          搜索
        </button>
      </form>

      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-gray-500 mb-4">
            {q || type ? "换个关键词试试？" : "还没有任何收藏"}
          </p>
          <Link
            href="/vocabulary/new"
            className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            + 添加第一个收藏
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/vocabulary/${item.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-lg font-semibold text-gray-900 truncate">
                        {item.word}
                      </span>
                      {item.reading && (
                        <span className="text-sm text-gray-500">
                          {item.reading}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {TYPE_LABEL[item.type]}
                      </span>
                      {item.level && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                          {item.level}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">{item.meaning}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            item.mastery >= 80
                              ? "bg-green-500"
                              : item.mastery >= 50
                                ? "bg-yellow-500"
                                : "bg-red-400"
                          }`}
                          style={{ width: `${item.mastery}%` }}
                          aria-label={`掌握度 ${item.mastery}%`}
                        />
                      </div>
                      <span className="text-xs text-gray-500 tabular-nums w-8 text-right">
                        {item.mastery}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDate(item.created_at)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
