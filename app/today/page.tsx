"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MistakeEntry = {
  id: string;
  timestamp: number;
  language: "zh" | "en";
  grammar: string[];
  vocabulary: string[];
};

type MistakeItem = {
  type: "grammar" | "vocab";
  text: string;
  ts: number;
  lang: "zh" | "en";
};

type AggregatedMistake = {
  text: string;
  type: "grammar" | "vocab";
  count: number;
  lastSeen: number;
};

const HISTORY_KEY = "japaneseLearning.mistakeHistory";

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Phase 4 follow-up: group identical mistakes across sessions so the
// learner can see which patterns keep coming back. Normalize via
// lowercase + trim + collapse whitespace, dedupe per (type, normalized),
// count occurrences, sort by count desc then by last-seen desc.
function aggregateMistakes(
  history: MistakeEntry[]
): AggregatedMistake[] {
  const map = new Map<
    string,
    { text: string; type: "grammar" | "vocab"; count: number; lastSeen: number }
  >();

  const normalize = (t: string) =>
    t.toLowerCase().trim().replace(/\s+/g, " ");

  for (const entry of history) {
    for (const g of entry.grammar) {
      const key = `g:${normalize(g)}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, entry.timestamp);
      } else {
        map.set(key, {
          text: g,
          type: "grammar",
          count: 1,
          lastSeen: entry.timestamp,
        });
      }
    }
    for (const v of entry.vocabulary) {
      const key = `v:${normalize(v)}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, entry.timestamp);
      } else {
        map.set(key, {
          text: v,
          type: "vocab",
          count: 1,
          lastSeen: entry.timestamp,
        });
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
    .slice(0, 10);
}

export default function TodayPage() {
  const [history, setHistory] = useState<MistakeEntry[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? (JSON.parse(raw) as MistakeEntry[]) : [];
      setHistory(parsed);
    } catch {
      setHistory([]);
    }
  }, []);

  function clearHistory() {
    if (typeof window === "undefined") return;
    if (!window.confirm("确定要清空所有弱点记录吗？此操作不可撤销。")) return;
    window.localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }

  // Flatten grammar + vocabulary from every session, tag with type + ts
  const allItems: MistakeItem[] = history.flatMap((m) => [
    ...m.grammar.map((g) => ({
      type: "grammar" as const,
      text: g,
      ts: m.timestamp,
      lang: m.language,
    })),
    ...m.vocabulary.map((v) => ({
      type: "vocab" as const,
      text: v,
      ts: m.timestamp,
      lang: m.language,
    })),
  ]);

  // Sort newest first, take latest 10
  const recentItems = allItems
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10);

  // Aggregate identical mistakes across sessions (Phase 4 follow-up)
  const topMistakes = aggregateMistakes(history);

  const sessionCount = history.length;

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <header className="mb-12">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← 返回
        </Link>
        <p className="text-sm text-gray-500 mt-4">FastStudy 2.0</p>
        <h1 className="text-3xl font-bold mt-1">今日训练</h1>
        <p className="text-gray-600 mt-2">
          Good evening.{" "}
          <span className="text-gray-400">连续训练 18 天 🔥</span>
        </p>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8">
        <div className="text-sm text-gray-500 mb-2">Today's Goal</div>
        <h2 className="text-2xl font-bold mb-8">约 30 分钟</h2>

        <ul className="space-y-3">
          <li className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50">
            <span>🎧 听力</span>
            <span className="text-sm text-gray-500">10 分钟</span>
          </li>
          <li className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50">
            <span>🎤 口语</span>
            <span className="text-sm text-gray-500">10 分钟</span>
          </li>
          <li className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50">
            <span>🔁 Shadowing</span>
            <span className="text-sm text-gray-500">5 分钟</span>
          </li>
          <li className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50">
            <span>📝 复习</span>
            <span className="text-sm text-gray-500">5 分钟</span>
          </li>
        </ul>

        <Link
          href="/speaking"
          className="block text-center mt-8 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          开始今天的训练 →
        </Link>
        <p className="text-xs text-gray-400 text-center mt-3">
          Phase 1 AI Conversation MVP 已启用
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            最近弱点
            {sessionCount > 0 && (
              <span className="ml-2 text-xs text-gray-400 normal-case font-normal">
                （{sessionCount} 次对话 · 累计 {allItems.length} 条）
              </span>
            )}
          </h3>
          {sessionCount > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              清空记录
            </button>
          )}
        </div>

        {recentItems.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">
            还没积累弱点记录。完成几次 AI 对话 + 选 "结束训练，获取反馈" 后会显示在这里。
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentItems.map((item, i) => (
              <li
                key={`${item.ts}-${i}`}
                className="flex items-start justify-between py-2 px-3 rounded-md hover:bg-gray-50 gap-3"
              >
                <span className="flex-1">
                  <span
                    className={`inline-block text-xs px-1.5 py-0.5 rounded mr-2 ${
                      item.type === "grammar"
                        ? "bg-red-50 text-red-600"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {item.type === "grammar" ? "语法" : "词汇"}
                  </span>
                  {item.text}
                </span>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatDate(item.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          常见错误 Top 10
          {topMistakes.length > 0 && (
            <span className="ml-2 text-xs text-gray-400 normal-case font-normal">
              （聚合自 {allItems.length} 条记录）
            </span>
          )}
        </h3>

        {topMistakes.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">
            还没有足够的反馈数据。至少需要一次 "结束训练，获取反馈" 后才会出现。
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {topMistakes.map((m, i) => (
              <li
                key={`${m.type}:${m.text}`}
                className="flex items-start justify-between py-2 px-3 rounded-md hover:bg-gray-50 gap-3"
              >
                <span className="flex-1">
                  <span
                    className={`inline-block text-xs px-1.5 py-0.5 rounded mr-2 ${
                      m.type === "grammar"
                        ? "bg-red-50 text-red-600"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {m.type === "grammar" ? "语法" : "词汇"}
                  </span>
                  {m.text}
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-xs text-gray-400">
                    {formatDate(m.lastSeen)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                    × {m.count}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}