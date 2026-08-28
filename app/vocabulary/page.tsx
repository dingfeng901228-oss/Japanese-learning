// /vocabulary — My Collection list page.
// Server Component that reads searchParams (q / type / sort) and renders
// the user's vocabulary_items via lib/vocabulary.ts.

import Link from "next/link";
import {
  listVocabularyItems,
  type VocabularyType,
  type VocabularySort,
} from "@/lib/vocabulary";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  type?: string;
  level?: string;
  sort?: string;
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

  const items = await listVocabularyItems({
    search: q || undefined,
    type,
    level,
    sort,
  });

  // Chrome extension source stat (per docs/0821requirements.docx §28
  // "我有多少词汇来自浏览器阅读？"). One cheap count query — no rows
  // shipped (head: true).
  const supabase = await createClient();
  // Per Frank #7163 (2026-08-28): the header "共 N 项" used items.length,
  // but PostgREST's default max_rows is 1000, so listVocabularyItems caps
  // the array at 1000 even when the DB has more. Adding new words past
  // 1000 makes the count stay stuck at "共 1000 项". Fix: a separate
  // count: "exact" query returns the true total regardless of the 1000-row
  // cap. RLS scopes this to the current user — no explicit user_id
  // filter needed (same pattern as browserSourcedCount below).
  const { count: totalCount } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true });
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
            {totalCount === 0
              ? q || type || level
                ? "没有匹配的收藏"
                : "还没有收藏，先添加一个吧"
              : q || type || level
                ? `共 ${totalCount} 项（匹配 ${items.length} 项）`
                : `共 ${totalCount} 项`}
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
      )}
    </main>
  );
}
