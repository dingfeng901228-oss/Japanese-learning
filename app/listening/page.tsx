"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Sentence = {
  id: string;
  ja: string;
  zh: string;
};

type Category = {
  id: string;
  label: string;
  emoji: string;
  sentences: Sentence[];
};

// 30 N5 starter sentences across 5 everyday scenes.
// Phase 1: static + inline. Future: extract to data file + add N4/N3 levels.
const CATEGORIES: Category[] = [
  {
    id: "self-intro",
    label: "自我介绍",
    emoji: "🙋",
    sentences: [
      { id: "s1-1", ja: "はじめまして。", zh: "初次见面。" },
      { id: "s1-2", ja: "私はディン・フェンと申します。", zh: "我叫丁锋。" },
      { id: "s1-3", ja: "中国から来ました。", zh: "我来自中国。" },
      { id: "s1-4", ja: "今は東京に住んでいます。", zh: "我现在住在东京。" },
      { id: "s1-5", ja: "ITエンジニアです。", zh: "我是 IT 工程师。" },
      { id: "s1-6", ja: "よろしくお願いします。", zh: "请多多关照。" },
    ],
  },
  {
    id: "restaurant",
    label: "餐厅",
    emoji: "🍱",
    sentences: [
      { id: "r1-1", ja: "注文をお願いします。", zh: "我想点餐。" },
      { id: "r1-2", ja: "ラーメンをください。", zh: "我要一份拉面。" },
      { id: "r1-3", ja: "おすすめは何ですか。", zh: "推荐什么？" },
      { id: "r1-4", ja: "辛くしないでください。", zh: "请不要加辣。" },
      { id: "r1-5", ja: "お会計をお願いします。", zh: "请结账。" },
      { id: "r1-6", ja: "現金で払います。", zh: "我付现金。" },
    ],
  },
  {
    id: "directions",
    label: "问路",
    emoji: "🗺️",
    sentences: [
      { id: "d1-1", ja: "駅はどこですか。", zh: "车站在哪里？" },
      { id: "d1-2", ja: "この道をまっすぐ行ってください。", zh: "请沿这条路直走。" },
      { id: "d1-3", ja: "右に曲がってください。", zh: "请向右转。" },
      { id: "d1-4", ja: "左に曲がってください。", zh: "请向左转。" },
      { id: "d1-5", ja: "どこまで歩けばいいですか。", zh: "需要走多远？" },
      { id: "d1-6", ja: "近くですか。", zh: "近吗？" },
    ],
  },
  {
    id: "numbers-time",
    label: "数字时间",
    emoji: "⏰",
    sentences: [
      { id: "n1-1", ja: "今、何時ですか。", zh: "现在几点？" },
      { id: "n1-2", ja: "三時です。", zh: "三点。" },
      { id: "n1-3", ja: "今日は何日ですか。", zh: "今天几号？" },
      { id: "n1-4", ja: "九月十五日です。", zh: "九月十五日。" },
      { id: "n1-5", ja: "電話番号を教えてください。", zh: "请告诉我电话号码。" },
      { id: "n1-6", ja: "百円です。", zh: "一百日元。" },
    ],
  },
  {
    id: "greetings",
    label: "寒暄",
    emoji: "👋",
    sentences: [
      { id: "g1-1", ja: "おはようございます。", zh: "早上好。" },
      { id: "g1-2", ja: "こんにちは。", zh: "你好（白天）。" },
      { id: "g1-3", ja: "こんばんは。", zh: "晚上好。" },
      { id: "g1-4", ja: "お疲れ様です。", zh: "辛苦了。" },
      { id: "g1-5", ja: "また明日。", zh: "明天见。" },
      { id: "g1-6", ja: "また会いましょう。", zh: "下次再见。" },
    ],
  },
];

const PROGRESS_KEY = "japaneseLearning.listening.progress";

function loadProgress(): Record<string, Set<string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const result: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[k] = new Set(v);
    }
    return result;
  } catch {
    return {};
  }
}

function saveProgress(progress: Record<string, Set<string>>) {
  if (typeof window === "undefined") return;
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(progress)) {
    out[k] = Array.from(v);
  }
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(out));
}

const RATE_OPTIONS = [
  { v: 0.7, label: "0.7x", desc: "慢速" },
  { v: 0.9, label: "0.9x", desc: "常速" },
  { v: 1.0, label: "1.0x", desc: "原速" },
] as const;

export default function ListeningPage() {
  const [categoryIdx, setCategoryIdx] = useState(0);
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [rate, setRate] = useState<number>(0.9);
  const [speaking, setSpeaking] = useState(false);
  const [progress, setProgress] = useState<Record<string, Set<string>>>({});
  const [browserSupportsTts, setBrowserSupportsTts] = useState(true);

  const category = CATEGORIES[categoryIdx];
  const sentence = category.sentences[sentenceIdx];
  const totalInCat = category.sentences.length;
  const completedInCat = progress[category.id]?.size || 0;
  const totalCompleted = Object.values(progress).reduce(
    (sum, set) => sum + set.size,
    0
  );
  const allDone = totalCompleted >= 30;

  // Detect Web Speech API support on mount (client only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setBrowserSupportsTts(Boolean(window.speechSynthesis));
    setProgress(loadProgress());
  }, []);

  // Cancel any in-flight speech when component unmounts.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function stopSpeech() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  function changeCategory(i: number) {
    setCategoryIdx(i);
    setSentenceIdx(0);
    stopSpeech();
  }

  function setRateAndCancel(r: number) {
    if (speaking) stopSpeech();
    setRate(r);
  }

  function speak() {
    if (!browserSupportsTts) {
      alert("当前浏览器不支持语音合成。请用 Chrome 或 Safari。");
      return;
    }
    if (speaking) {
      stopSpeech();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(sentence.ja);
    u.lang = "ja-JP";
    u.rate = rate;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);

    // Mark sentence as listened (no-op if already in set).
    const newProgress: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(progress)) {
      newProgress[k] = new Set(v);
    }
    if (!newProgress[category.id]) newProgress[category.id] = new Set();
    newProgress[category.id].add(sentence.id);
    setProgress(newProgress);
    saveProgress(newProgress);
  }

  function next() {
    stopSpeech();
    if (sentenceIdx < totalInCat - 1) {
      setSentenceIdx(sentenceIdx + 1);
    } else if (categoryIdx < CATEGORIES.length - 1) {
      setCategoryIdx(categoryIdx + 1);
      setSentenceIdx(0);
    } else {
      // Last sentence in last category — loop to start of current cat.
      setSentenceIdx(0);
    }
  }

  function prev() {
    stopSpeech();
    if (sentenceIdx > 0) {
      setSentenceIdx(sentenceIdx - 1);
    } else if (categoryIdx > 0) {
      const prevCat = CATEGORIES[categoryIdx - 1];
      setCategoryIdx(categoryIdx - 1);
      setSentenceIdx(prevCat.sentences.length - 1);
    } else {
      setSentenceIdx(totalInCat - 1);
    }
  }

  const sentenceHeard = progress[category.id]?.has(sentence.id) ?? false;

  return (
    <main className="min-h-screen flex flex-col px-6 py-8 max-w-3xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/today"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 今日训练
        </Link>
        <Link
          href="/speaking"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          口语训练 →
        </Link>
      </header>

      <h1 className="text-2xl font-bold mb-2">听力训练</h1>
      <p className="text-sm text-gray-500 mb-6">
        听 AI 朗读：5 场景 × 6 句 = 30 句 N5 起步。点 🔊 听、慢速 / 常速切换、上一句 /
        下一句。
      </p>

      {/* Category tabs */}
      <div
        className="flex gap-2 mb-6 overflow-x-auto pb-2"
        role="tablist"
        aria-label="场景分类"
      >
        {CATEGORIES.map((c, i) => {
          const done = progress[c.id]?.size || 0;
          const total = c.sentences.length;
          const allListened = done === total && total > 0;
          const active = i === categoryIdx;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              onClick={() => changeCategory(i)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : allListened
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span className="mr-1">{c.emoji}</span>
              {c.label}
              {allListened && <span className="ml-1">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Sentence card */}
      <section className="border border-gray-200 rounded-2xl p-6 mb-6 bg-white">
        <div className="text-sm text-gray-500 mb-3 flex items-center justify-between">
          <span>
            {category.label} · 第 {sentenceIdx + 1} / {totalInCat} 句
          </span>
          {sentenceHeard && (
            <span className="text-xs text-green-600">✓ 听过了</span>
          )}
        </div>

        <div
          className="text-3xl font-bold mb-4 leading-relaxed text-center py-4 break-words"
          lang="ja"
        >
          {sentence.ja}
        </div>

        <div className="text-base text-gray-600 text-center mb-6">
          {sentence.zh}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <button
            type="button"
            onClick={speak}
            disabled={!browserSupportsTts}
            className={`px-6 py-3 rounded-lg text-base font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              speaking
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-gray-900 text-white hover:bg-gray-800"
            }`}
          >
            {speaking ? "⏹ 停止" : "🔊 听"}
          </button>

          <div
            className="inline-flex rounded-lg border border-gray-200 overflow-hidden self-center"
            role="group"
            aria-label="语速"
          >
            {RATE_OPTIONS.map((opt, i) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setRateAndCancel(opt.v)}
                className={`px-3 py-3 text-sm transition-colors ${
                  i > 0 ? "border-l border-gray-200" : ""
                } ${
                  rate === opt.v
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
                title={`${opt.desc} ${opt.label}`}
                aria-pressed={rate === opt.v}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={prev}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm"
        >
          ← 上一句
        </button>

        <div className="flex-1 text-sm text-gray-500 text-center">
          本组完成 {completedInCat}/{totalInCat} · 总进度 {totalCompleted}/30
        </div>

        <button
          type="button"
          onClick={next}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm"
        >
          下一句 →
        </button>
      </div>

      {/* All-done celebration */}
      {allDone && (
        <div className="border border-green-200 bg-green-50 rounded-2xl p-6 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <div className="text-base font-medium text-green-800 mb-1">
            全部 30 句都听过了
          </div>
          <div className="text-sm text-green-700">
            去 <Link href="/speaking" className="underline">口语训练</Link> 试试自己说，或者回 <Link href="/today" className="underline">今日训练</Link> 看错点
          </div>
        </div>
      )}

      {!browserSupportsTts && (
        <div className="mt-4 border border-red-200 bg-red-50 rounded-2xl p-4 text-sm text-red-700 text-center">
          当前浏览器不支持 Web Speech API。请用 Chrome / Safari 打开本页面。
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400 text-center">
        🔊 TTS 通过 Web Speech API（无需联网）
      </div>
    </main>
  );
}
