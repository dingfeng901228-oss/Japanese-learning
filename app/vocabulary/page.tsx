// /vocabulary — My Collection list page.
// Server Component that reads searchParams (q / type / sort) and renders
// the user's vocabulary_items via lib/vocabulary.ts.

import Link from "next/link";
import {
  listVocabularyItemsPaged,
  type VocabularyType,
  type VocabularySort,
} from "@/lib/vocabulary";
import { createClient } from "@/lib/supabase/server";
import { PageInput } from "./PageInput";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  type?: string;
  level?: string;
  sort?: string;
  page?: string;
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

// Per Frank #7347 (2026-08-30): /vocabulary pagination.
function asPage(v: string | undefined): number {
  if (!v) return 1;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

// Build /vocabulary?… href preserving all current filters + new page.
// Used by prev / next nav so paging never drops a filter (e.g. q +
// type + level follow the user across ?page= changes).
function buildHref(params: Record<string, unknown>): string {
  const qs = Object.entries(params)
    .filter(([, val]) => val !== undefined && val !== "")
    .map(
      ([k, val]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(val))}`
    )
    .join("&");
  return qs ? `/vocabulary?${qs}` : "/vocabulary";
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

  // Per Frank #7347 (2026-08-30): paginate via ?page=N, default 20/page.
  // listVocabularyItemsPaged's `count: "exact"` returns the TRUE total
  // regardless of the 1000-row PostgREST cap — subsumes Frank #7163's
  // separate count workaround (no standalone `totalCount` query needed).
  const {
    items,
    total,
    totalPages,
    page: currentPage,
  } = await listVocabularyItemsPaged({
    search: q || undefined,
    type,
    level,
    sort,
    page: asPage(sp.page),
  });

  // Chrome extension source stat (per docs/0821requirements.docx §28
  // "我有多少词汇来自浏览器阅读？"). One cheap count query — no rows
  // shipped. Independent of pagination (paged result only covers the
  // current page window; this stat stays across the whole collection).
  const supabase = await createClient();
  const { count: browserSourcedCount } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("source", "chrome-extension");

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <header className="mb-8">
        {/* Per Frank #6578: put "我的收藏", "共~项", and "+手动添加" on
            the same row (header). Title on the left, count in the middle,
            styled "+手动添加" button on the far right. Matches the visual
            treatment used on the detail page (commit 29a3a28) and the
            list page toolbar (commit fddb30a). */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-3xl font-bold">我的收藏</h1>
          <p className="text-gray-600">
            {total === 0
              ? q || type || level
                ? "没有匹配的收藏"
                : "还没有收藏，先添加一个吧"
              : q || type || level
                ? `共 ${total} 项（匹配 ${items.length} 项）`
                : `共 ${total} 项`}
          </p>
          <div className="flex items-center gap-2">
            {/* Per Frank #7033: he expected a button on /vocabulary to
                reach /admin/import-vocab (which I shipped in commit
                2af164f). Surface it next to "+手动添加" so the bulk
                path is discoverable. Secondary visual weight — manual
                add stays primary. */}
            <Link
              href="/admin/import-vocab"
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              title="批量导入词汇（JSON / 预置 200 词）"
            >
              📦 批量导入
            </Link>
            <Link
              href="/vocabulary/new"
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              + 手动添加
            </Link>
          </div>
        </div>
        {browserSourcedCount !== null && browserSourcedCount > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            来自浏览器阅读：<strong>{browserSourcedCount}</strong> 个
          </p>
        )}
      </header>

      {/* Per Frank #6628: removed the "一键生成所有缺失例句" button +
          batch banner + the `/api/vocabulary/batch-generate-examples`
          route. The toolbar above the search form is gone entirely —
          users can generate missing examples per-word via the
          "生成例句" button on each detail page (see
          regenerateExampleAction in app/vocabulary/actions.ts). */}

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
        <>
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
                    {item.source === "chrome-extension" && item.source_domain && (
                      <div className="text-xs text-blue-600 mt-1.5 truncate">
                        🌐 {item.source_domain}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDate(item.created_at)}
                  </div>
                </div>
              </Link>
            </li>
          ))}
          </ul>

          {/* Per Frank #7347 (2026-08-30): pagination nav.
              Prev / Next + "第 X / Y 页 · 共 N 个". page changes
              preserve all current filters via buildHref().

              Per Frank #7397 (2026-08-31, docs/vocabuly0831.md §一):
              "第 X / Y 页" replaced by <PageInput> — Enter / blur
              navigates to the typed page directly; < 1 → 1,
              > totalPages → totalPages, !Number → restore. PageInput
              mutates only `page` in the URL, so q / type / level /
              sort follow through to the new page. */}
          {totalPages > 1 && (
            <nav
              className="mt-8 flex items-center justify-center gap-3 text-sm"
              aria-label="分页"
            >
              {currentPage > 1 ? (
                <Link
                  href={buildHref({
                    q,
                    type,
                    level,
                    sort,
                    page: currentPage - 1,
                  })}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← 上一页
                </Link>
              ) : (
                <span className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-300 cursor-not-allowed">
                  ← 上一页
                </span>
              )}
              <PageInput currentPage={currentPage} totalPages={totalPages} />
              <span className="text-gray-500">· 共 {total} 个</span>
              {currentPage < totalPages ? (
                <Link
                  href={buildHref({
                    q,
                    type,
                    level,
                    sort,
                    page: currentPage + 1,
                  })}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  下一页 →
                </Link>
              ) : (
                <span className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-300 cursor-not-allowed">
                  下一页 →
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
