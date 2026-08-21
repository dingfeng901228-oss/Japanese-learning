"use client";

// WeaknessProfile — recent mistakes + aggregated top-10, sourced from
// localStorage mistake history written by /speaking's "获取反馈" flow
// (lib/speaking-queue.ts).
//
// Per Frank #6615 #3, this was moved off /today onto /progress so the
// dashboard has the full weakness picture (mastery stats + listening
// completion + shadow stats + mistake history) in one place.
//
// Two sections:
//   - 最近弱点 (top 10 individual mistakes sorted by ts)
//   - 常见错误 Top 10 (aggregated by (type, text), ranked by count)
//
// Both render their own empty state when the user hasn't recorded any
// /speaking feedback yet, so this component is safe to render
// unconditionally.

import { useEffect, useState } from "react";

const HISTORY_KEY = "japaneseLearning.mistakeHistory";

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

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function aggregateMistakes(
  history: MistakeEntry[],
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

export function WeaknessProfile() {
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

  const recentItems = allItems
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10);

  const topMistakes = aggregateMistakes(history);

  const sessionCount = history.length;

  return (
    <>
      <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
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

      <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
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
            {topMistakes.map((m) => (
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
    </>
  );
}