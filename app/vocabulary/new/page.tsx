"use client";

// /vocabulary/new — quick add form.
//
// Two-tier completion:
//   1. Instant dictionary lookup (client, public/dict/lookup.json —
//      JMdict-derived, see public/dict/ATTRIBUTION.md). Typing shows
//      reading / Chinese meaning / POS / JLPT level / example instantly.
//      Picking a result fills the hidden fields below, so the server
//      action stores dictionary-accurate data.
//   2. AI fallback (server, lib/vocabulary/enrich.ts → gpt-4o-mini) for
//      words the dictionary doesn't cover, or for grammar / sentence
//      entries where a dictionary lookup doesn't apply.
//
// The detail page at /vocabulary/[id] shows the completed fields; if any
// look wrong, future Phase 3+ work will let users edit them in-place.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { createVocabularyItemAction } from "../actions";
import { DictLookupInput } from "@/components/vocabulary/DictLookupInput";
import { DictionaryAttribution } from "@/components/vocabulary/DictionaryAttribution";

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
  // The word field is controlled so the lookup dropdown can drive it.
  const [word, setWord] = useState("");
  // Dictionary-derived fields, submitted as hidden inputs. Empty means
  // "let the AI fill it".
  const [dict, setDict] = useState({
    reading: "",
    meaning: "",
    level: "",
    partOfSpeech: "",
    freqRank: 0,
  });
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
          输入即查词典：假名读音、中文意思、JLPT 等级、词性立即显示，选中后自动填入。
          词典未收录的词由 AI 补全。
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
          {type === "word" || type === "phrase" ? (
            <DictLookupInput
              id="vocab-word"
              value={word}
              onChange={setWord}
              onPick={setDict}
              placeholder={TYPE_PLACEHOLDER[type]}
            />
          ) : (
            <input
              id="vocab-word"
              type="text"
              name="word"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900"
              placeholder={TYPE_PLACEHOLDER[type]}
            />
          )}
          {/* Dictionary-derived values, submitted alongside the word. When
              they're empty the server action falls through to the AI
              enrichment path — exactly the old behaviour.

              The dictionary's example sentences are Chinese-only (the
              Japanese side isn't in the open data layer), so they're
              shown in the dropdown as a usage hint but not submitted —
              vocabulary_examples.sentence needs a Japanese sentence and
              the AI path already produces one. */}
          <input type="hidden" name="reading" value={dict.reading} />
          <input type="hidden" name="meaning" value={dict.meaning} />
          <input type="hidden" name="level" value={dict.level} />
          <input type="hidden" name="part_of_speech" value={dict.partOfSpeech} />
          <input
            type="hidden"
            name="freq_rank"
            value={dict.freqRank ? String(dict.freqRank) : ""}
          />
          {dict.reading && (
            <p className="text-xs text-gray-500 mt-2">
              已从词典填入：
              <span className="font-jp">{dict.reading}</span>
              {dict.level && ` · ${dict.level}`}
              {dict.meaning && ` · ${dict.meaning}`}
            </p>
          )}
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
            词典已收录的词直接保存（无需等待）；未收录的词由 AI 补全（约 1-3 秒）。
            跳转到详情页可看到全部内容。
          </p>
        </form>

        <div className="mt-6">
          <DictionaryAttribution />
        </div>
      </main>
    );
  }
