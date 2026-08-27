"use client";

// /vocabulary/new — quick add form. Only "word / phrase" is required;
// AI auto-generates reading, meaning, JLPT level, and part of speech
// behind the scenes (lib/vocabulary/enrich.ts → gpt-4o-mini).
//
// The detail page at /vocabulary/[id] shows the AI-filled fields; if
// any look wrong, future Phase 3+ work will let users edit them
// in-place.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { createVocabularyItemAction } from "../actions";

type VocabularyType = "word" | "phrase" | "grammar" | "sentence";

const TYPE_OPTIONS: { value: VocabularyType; label: string }[] = [
  { value: "word", label: "单词" },
  { value: "phrase", label: "词组" },
  { value: "grammar", label: "文法" },
  { value: "sentence", label: "句型" },
];

const TYPE_PLACEHOLDER: Record<VocabularyType, string> = {
  word: "例：身につける",
  phrase: "例：〜を身につける",
  grammar: "例：「〜ようにする」",
  sentence: "例：「毎日練習して、〜」",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "AI 补全中…" : "保存"}
    </button>
  );
}

export default function NewVocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [type, setType] = useState<VocabularyType>("word");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    searchParams.then((sp) => {
      if (cancelled) return;
      if (sp.error === "missing_word") {
        setError("单词 / 词组不能为空");
      } else if (sp.error === "duplicate") {
        // Per Frank #7103 (2026-08-28): the previous generic
        // "保存失败，请稍后重试" message was misleading on duplicate
        // adds. PG 23505 unique_violation from the partial unique index
        // on (user_id, word[, reading]) in 0005_chrome_extension.sql
        // is a user input issue, not a server failure — the word is
        // already in this user's collection.
        setError("该词已在你的收藏中，请勿重复添加");
      } else if (sp.error === "create_failed") {
        // Per Frank #7094 (2026-08-27): the action used to bubble a
        // generic "Application error: server-side exception" with no
        // actionable info. Now it redirects here with error=create_failed
        // so the user sees something useful instead.
        setError(
          "保存失败，请稍后重试。如果持续失败请联系管理员。"
        );
      } else {
        setError("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <header className="mb-8">
        <Link
          href="/vocabulary"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 返回收藏
        </Link>
        <h1 className="text-3xl font-bold mt-4">添加新收藏</h1>
        <p className="text-gray-600 mt-2">
          只输入单词 / 词组，其他字段（中文意思、假名读音、JLPT 等级、词性）由 AI 自动生成。
        </p>
      </header>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        action={createVocabularyItemAction}
        className="space-y-6 bg-white border border-gray-200 rounded-2xl p-8"
      >
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-2">
            类型
          </legend>
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            role="radiogroup"
            aria-label="类型"
          >
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={type === opt.value}
                onClick={() => setType(opt.value)}
                className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                  type === opt.value
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="type" value={type} />
        </fieldset>

        <div>
          <label
            htmlFor="vocab-word"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {type === "grammar" || type === "sentence"
              ? "表达 / 句型"
              : "单词 / 词组"}{" "}
            *
          </label>
          <input
            id="vocab-word"
            type="text"
            name="word"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
            placeholder={TYPE_PLACEHOLDER[type]}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <SubmitButton />
          <Link
            href="/vocabulary"
            className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </Link>
        </div>

        <p className="text-xs text-gray-400 pt-2">
          保存后 AI 用 gpt-4o-mini 自动补全，跳转到详情页即可看到全部内容（约 1-3 秒）。
        </p>
      </form>
    </main>
  );
}
