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
import { getUserLearningState } from "@/lib/vocabulary/learn";

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

// Per Frank #7397 (2026-08-31, docs/vocabuly0831.md §十四 + §二十三):
// "上次学习：昨天 21:32" style relative-time label on the
// "继续学习" card. Server timestamps are UTC, user is JST, so the
// absolute date fallback shifts +9h to display in JST. The diff itself
// is timezone-independent (absolute timestamps cancel out).
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

// Build /vocabulary/learn href carrying the current list-page filters
// as ?filter_type=...&filter_level=...&filter_sort=...&filter_query=...
// params. /vocabulary/learn reads these to call start_learning_session
// with the right filter_context — which user_learning_state then
// stores, powering the next visit's "原学习类型" display (per
// Frank #7397 Q5-α). When no filters are set, the href is the bare
// /vocabulary/learn path — the RPC's COALESCE clause preserves the
// previously-stored filter in that case (so a [继续学习] click does
// NOT clobber the existing "原 filter" label).
function buildLearnHref(fc: {
  q: string;
  type?: VocabularyType;
  level?: string;
  sort: string;
}): string {
  const params = new URLSearchParams();
  if (fc.q) params.set("filter_query", fc.q);
  if (fc.type) params.set("filter_type", fc.type);
  if (fc.level) params.set("filter_level", fc.level);
  if (fc.sort && fc.sort !== "newest") params.set("filter_sort", fc.sort);
  const qs = params.toString();
  return qs ? `/vocabulary/learn?${qs}` : "/vocabulary/learn";
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

  // Per Frank #7397 (2026-08-31, docs/vocabuly0831.md §十四 +
  // §二十三): drives the "继续学习" card and the "今日学习已完成"
  // banner. The empty-state branch (no vocab) skips both anyway.
  const userLearningState = await getUserLearningState();

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

      {/* Per Frank #7397 (2026-08-31, docs/vocabuly0831.md §十四 +
          §十五 + §二十三): "继续学习" card + "今日学习已完成 ✓"
          banner. Only rendered when the user has at least one vocab
          (otherwise the empty state below takes over). Ignores the
          current page filter (Q5-α); the original filter context is
          displayed inline so the user understands where they were
          studying last. The [继续学习 →] / [重新开始] button is a
          plain Link — the LearnSession client component handles the
          session-start RPC + redirect when it mounts. */}
      {total > 0 &&
        (userLearningState.lastLearningVocabulary ||
          userLearningState.dailyStatus === "completed") && (
          <section className="mb-6 space-y-3">
            {userLearningState.lastLearningVocabulary && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                  继续学习
                </p>
                <div className="flex items-baseline gap-2 flex-wrap mb-1">
                  <span className="text-sm text-gray-500">上次学到：</span>
                  <strong className="text-lg text-gray-900">
                    {userLearningState.lastLearningVocabulary.word}
                  </strong>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  {TYPE_LABEL[
                    userLearningState.lastLearningVocabulary
                      .type as VocabularyType
                  ] ??
                    userLearningState.lastLearningVocabulary.type}
                  {userLearningState.lastLearningVocabulary.level && (
                    <>
                      {" · "}
                      {userLearningState.lastLearningVocabulary.level}
                    </>
                  )}
                  {userLearningState.lastLearningAt && (
                    <>
                      {" · 上次学习："}
                      {formatRelativeTime(userLearningState.lastLearningAt)}
                    </>
                  )}
                </p>
                {userLearningState.filterContext &&
                  (userLearningState.filterContext.type ||
                    userLearningState.filterContext.level ||
                    userLearningState.filterContext.sort ||
                    userLearningState.filterContext.query) && (
                    <p className="text-xs text-gray-500 mb-3">
                      原学习类型：
                      {[
                        userLearningState.filterContext.type
                          ? (TYPE_LABEL[
                              userLearningState.filterContext
                                .type as VocabularyType
                            ] ??
                              userLearningState.filterContext.type)
                          : null,
                        userLearningState.filterContext.level,
                        userLearningState.filterContext.sort === "oldest"
                          ? "最早收藏"
                          : userLearningState.filterContext.sort === "word"
                            ? "按 A-Z"
                            : null,
                        userLearningState.filterContext.query
                          ? `搜索 "${userLearningState.filterContext.query}"`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                <Link
                  href={buildLearnHref({ q, type, level, sort })}
                  className="inline-block px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  继续学习 →
                </Link>
              </div>
            )}

            {userLearningState.dailyStatus === "completed" && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-base text-green-900 font-medium">
                    今日学习已完成 ✓
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    想再走一遍？随时可以开启新一段。
                  </p>
                </div>
                <Link
                  href={buildLearnHref({ q, type, level, sort })}
                  className="px-5 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  重新开始
                </Link>
              </div>
            )}
          </section>
        )}

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
