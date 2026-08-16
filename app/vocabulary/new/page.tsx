"use client";

// /vocabulary/new — manual add form (Phase 2).
// AI-generated examples / rephrase / user-edit come in Phase 3.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createVocabularyItemAction } from "../actions";

type VocabularyType = "word" | "phrase" | "grammar" | "sentence";

type SearchParams = {
  error?: string;
  word?: string;
  reading?: string;
  type?: string;
  level?: string;
  part_of_speech?: string;
};

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

export default function NewVocabularyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [type, setType] = useState<VocabularyType>("word");
  const [error, setError] = useState<string>("");
  const [prefill, setPrefill] = useState<{
    word: string;
    reading: string;
    level: string;
    partOfSpeech: string;
  }>({ word: "", reading: "", level: "", partOfSpeech: "" });

  // Pull validation-error prefill from query params.
  // searchParams is a Promise in Next.js 15 — resolve it in useEffect.
  useEffect(() => {
    let cancelled = false;
    searchParams.then((sp) => {
      if (cancelled) return;
      setError(sp.error === "missing" ? "单词 / 词组 和中文意思都不能为空" : "");
      setPrefill({
        word: sp.word ?? "",
        reading: sp.reading ?? "",
        level: sp.level ?? "",
        partOfSpeech: sp.part_of_speech ?? "",
      });
      if (
        sp.type === "phrase" ||
        sp.type === "grammar" ||
        sp.type === "sentence"
      ) {
        setType(sp.type);
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
          手动添加单词或词组。后续阶段会接 AI 自动生成例句。
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="类型">
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
            defaultValue={prefill.word}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
            placeholder={TYPE_PLACEHOLDER[type]}
          />
        </div>

        <div>
          <label
            htmlFor="vocab-reading"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            假名 / 读音（可选）
          </label>
          <input
            id="vocab-reading"
            type="text"
            name="reading"
            defaultValue={prefill.reading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
            placeholder="例：みにつける"
          />
        </div>

        <div>
          <label
            htmlFor="vocab-meaning"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            中文意思 *
          </label>
          <input
            id="vocab-meaning"
            type="text"
            name="meaning"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
            placeholder="例：掌握、学会"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="vocab-level"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              JLPT 等级（可选）
            </label>
            <select
              id="vocab-level"
              name="level"
              defaultValue={prefill.level}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 bg-white"
            >
              <option value="">不指定</option>
              <option value="N5">N5</option>
              <option value="N4">N4</option>
              <option value="N3">N3</option>
              <option value="N2">N2</option>
              <option value="N1">N1</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="vocab-pos"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              词性（可选）
            </label>
            <input
              id="vocab-pos"
              type="text"
              name="part_of_speech"
              defaultValue={prefill.partOfSpeech}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
              placeholder="例：他动词"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            保存
          </button>
          <Link
            href="/vocabulary"
            className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </Link>
        </div>
      </form>
    </main>
  );
}
