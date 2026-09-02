// /admin/import-vocab — admin-only bulk import UI for vocabulary.
//
// Auth-gated by lib/supabase/middleware.ts (PROTECTED_PREFIXES now
// includes "/admin"). Two import paths:
//   1. Pre-loaded: one-click button per batch from the whitelist in
//      ./batches.ts. Each batch file lives at data/<filename>.json
//      (force-added to git since data/ is otherwise gitignored).
//   2. Custom: paste JSON from any future batch (e.g. when Frank
//      produces the next 300 words in the same MD format).
//
// Both paths share the bulk-import server actions in ./actions.ts.
//
// Idempotent: re-running skips existing words (matched by exact
// `word` for the current user). Safe to retry.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  importPreloadedBatchAction,
  importPastedAction,
  importPastedMdAction,
} from "./actions";
import { PRELOADED_BATCHES } from "./batches";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "词汇批量导入 · jp.frank2025.com",
  robots: { index: false, follow: false }, // admin-only — never indexed
};

type SearchParams = {
  batch?: string;
  inserted?: string;
  skipped?: string;
  failed?: string;
  firstError?: string;
  error?: string;
};

export default async function ImportVocabPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Quick user-scoped vocab count for the header status line.
  const { count: userVocabCount } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: totalItemsInJson } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const showResult = sp.inserted != null || sp.failed != null;
  const showError = Boolean(sp.error);

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <header className="mb-8">
        <Link
          href="/vocabulary"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 返回收藏
        </Link>
        <h1 className="text-3xl font-bold mt-4">📦 词汇批量导入</h1>
        <p className="text-gray-600 mt-2">
          当前账号已收录 <strong>{userVocabCount ?? 0}</strong> 个词汇
          {totalItemsInJson != null && totalItemsInJson === userVocabCount
            ? ""
            : ""}
          。所有操作走你的 OAuth session，RLS 自动通过。
        </p>
      </header>

      {/* Result banner (post-import) */}
      {showResult && !showError && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm">
          <p className="font-medium text-green-800">
            ✅ 导入完成{sp.batch ? `（批次：${sp.batch}）` : ""}
          </p>
          <p className="text-green-700 mt-1">
            新增 <strong>{sp.inserted ?? 0}</strong>，
            跳过 <strong>{sp.skipped ?? 0}</strong>（重复词，已存在）
            {sp.failed != null && Number(sp.failed) > 0 && (
              <>
                ，失败 <strong className="text-red-700">{sp.failed}</strong>
              </>
            )}
            。
          </p>
          {sp.firstError && (
            <p className="text-xs text-red-700 mt-2">
              首条错误：{sp.firstError}
            </p>
          )}
          <p className="text-xs text-green-700 mt-2">
            <Link href="/vocabulary" className="underline">
              打开 /vocabulary
            </Link>
            <span className="mx-2">·</span>
            <Link href="/review" className="underline">
              打开 /review（200 条都在复习队列里）
            </Link>
          </p>
        </div>
      )}

      {/* Error banner */}
      {showError && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          ❌ {sp.error}
        </div>
      )}

      {/* ── Section 1: pre-loaded batches ───────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-8 mb-6">
        <h2 className="text-lg font-semibold mb-2">
          预置批次（一键导入）
        </h2>
        <p className="text-sm text-gray-600 mb-5">
          数据源在 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">data/</code> 下，每个批次一个 JSON 文件。
          点按钮直接 bulk insert；重复词自动跳过，幂等。
        </p>
        <div className="space-y-5">
          {PRELOADED_BATCHES.map((batch, idx) => (
            <form
              action={importPreloadedBatchAction}
              key={batch.filename}
              className={idx > 0 ? "pt-5 border-t border-gray-100" : ""}
            >
              <input type="hidden" name="batch" value={batch.filename} />
              <p className="font-medium mb-1">{batch.label}</p>
              <p className="text-xs text-gray-500 mb-3">{batch.description}</p>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                导入该批次
              </button>
              <span className="ml-3 text-xs text-gray-500">
                <code>data/{batch.filename}</code>
              </span>
            </form>
          ))}
        </div>
      </section>

      {/* ── Section 2: paste JSON ────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-8">
        <h2 className="text-lg font-semibold mb-2">
          自定义批次（粘贴 JSON）
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          用于将来其他批次（如饮食・烹饪 / 交通出行 / 教育学习 / 经济金融 /
          科技 IT 等）。格式与
          <code className="bg-gray-100 px-1 rounded text-xs mx-1">
            jlpt-vocab-200.json
          </code>
          一致：JSON 数组，每项含
          <code className="bg-gray-100 px-1 rounded text-xs mx-1">
            word / reading / meaning / level / category / example
          </code>
          。
        </p>
        <form action={importPastedAction}>
          <textarea
            name="json"
            required
            rows={10}
            spellCheck={false}
            placeholder={`[\n  {\n    "word": "例：着手",\n    "reading": "ちゃくしゅ",\n    "meaning": "动手，开始",\n    "level": "N1",\n    "category": "工作・职场",\n    "example": {\n      "sentence": "新しいプロジェクトに着手した。",\n      "reading": "あたら・ちゃくしゅ",\n      "translation": "开始着手新项目了。"\n    }\n  }\n]`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs mb-3 focus:outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            解析并导入
          </button>
        </form>
        <details className="mt-4 text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-900">
            字段约定
          </summary>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            <li>
              <code>word</code>：汉字（或纯假名/片假名词）。必填。
            </li>
            <li>
              <code>reading</code>：假名读音。无汉字的词可省略。
            </li>
            <li>
              <code>meaning</code>：中文释义（多义用「，」分隔）。必填。
            </li>
            <li>
              <code>level</code>：JLPT 等级（N1 / N2）。空值允许，导入时清空。
            </li>
            <li>
              <code>category</code>：主题分类，写入
              <code>vocabulary_tags.tag</code>。
            </li>
            <li>
              <code>example.sentence</code>：日文例句。必填。
            </li>
            <li>
              <code>example.reading</code>：句中汉字的假名（用「・」分隔）。
            </li>
            <li>
              <code>example.translation</code>：例句中文翻译。
            </li>
          </ul>
        </details>
      </section>

      <p className="text-xs text-gray-400 mt-8">
        本页面路由 <code>/admin/import-vocab</code> 仅登录用户可访问
        （PROTECTED_PREFIXES 已加 /admin）。所有写操作走 Supabase RLS，
        user_id 自动绑定当前 session。
      </p>

      {/* ── Section 3: paste / upload MD (per Frank #7631) ─────────── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-8 mt-6">
        <h2 className="text-lg font-semibold mb-2">
          粘贴 MD / 上传 .md 文件
          <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full align-middle">
            新增
          </span>
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          把 <code className="bg-gray-100 px-1 rounded text-xs">JLPT_N2-N1_词汇样本_第X批200词.md</code>{" "}
          文件内容贴到下面，或直接选择文件上传。
          服务端实时解析并导入，省去 JSON 中间文件。
        </p>
        <form action={importPastedMdAction} encType="multipart/form-data">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            上传 .md 文件
          </label>
          <input
            type="file"
            name="mdFile"
            accept=".md,text/markdown,text/plain"
            className="block w-full text-sm text-gray-700 mb-4 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-900 file:text-white file:cursor-pointer hover:file:bg-gray-800"
          />
          <label className="block text-sm font-medium text-gray-700 mb-2">
            或直接粘贴 MD 内容
          </label>
          <textarea
            name="md"
            rows={6}
            spellCheck={false}
            placeholder={`# JLPT N2-N1 主题词汇 第X批（第N-M词）\n\n## 一、章节标题（25词）\n\n1. **単語（たんご）** — 单词〔N2〕\n    例：新しい単語を覚えた。\n    （あたら・たんご・さぼ）\n    译：记住了新单词。`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs mb-3 focus:outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            解析 MD 并导入
          </button>
        </form>
        <details className="mt-4 text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-900">
            MD 格式约定
          </summary>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            <li>
              章节标题 <code>## 名称（NN词）</code>。可省略"（NN词）"后缀。
            </li>
            <li>
              词条 <code>**漢字（よみ）** — 释义〔N1|N2〕</code>。纯片假名词可省略括号读音。
            </li>
            <li>
              例句 / 汉字读音 / 中文翻译各占一行（缩进 4 空格），前缀{" "}
              <code>例：</code> / <code>（读音・读音）</code> / <code>译：</code>。
            </li>
            <li>
              空 hint 允许（如 <code>（）</code>），写入{" "}
              <code>example.reading = null</code>。
            </li>
            <li>
              解析后服务端跑 validateBatch：有 error 立即中止并跳回错误提示。
            </li>
          </ul>
        </details>
      </section>
    </main>
  );
}