"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ShadowGrade = {
  accuracy: number;
  fluency: number;
  feedback: string;
  suggestions: string[];
  encouragement: string;
};

type ShadowHistoryEntry = {
  id: string;
  sentenceId: string;
  categoryId: string;
  timestamp: number;
  transcript: string;
  grade: ShadowGrade;
};

// Same keys as /listening/page.tsx — read-only here.
const PROGRESS_KEY = "japane…ress";
const SHADOW_HISTORY_KEY = "japane…tory";

const CATEGORY_LABELS: Record<string, { emoji: string; label: string }> = {
  "self-intro": { emoji: "🙋", label: "自我介绍" },
  restaurant: { emoji: "🍱", label: "餐厅" },
  directions: { emoji: "🗺️", label: "问路" },
  "numbers-time": { emoji: "⏰", label: "数字时间" },
  greetings: { emoji: "👋", label: "寒暄" },
};

const LEVELS = ["N5", "N4", "N3"] as const;
const TOTAL_SENTENCES_PER_LEVEL = 30; // 6 sentences × 5 categories

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

function loadShadowHistory(): ShadowHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHADOW_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ShadowHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)} -${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function difficultyOf(sentenceId: string): "N5" | "N4" | "N3" | null {
  const m = sentenceId.match(/-n([543])-\d+$/);
  return m ? (`N${m[1]}` as "N5" | "N4" | "N3") : null;
}

export default function ProgressPage() {
  const [progress, setProgress] = useState<Record<string, Set<string>>>({});
  const [shadowHistory, setShadowHistory] = useState<ShadowHistoryEntry[]>([]);

  useEffect(() => {
    setProgress(loadProgress());
    setShadowHistory(loadShadowHistory());
  }, []);

  // Listen progress aggregate
  const totalListened = Object.values(progress).reduce(
    (s, set) => s + set.size,
    0
  );
  const listenedByLevel: Record<"N5" | "N4" | "N3", number> = {
    N5: 0,
    N4: 0,
    N3: 0,
  };
  for (const set of Object.values(progress)) {
    for (const sentId of set) {
      const lvl = difficultyOf(sentId);
      if (lvl) listenedByLevel[lvl]++;
    }
  }
  const totalPossible = LEVELS.length * TOTAL_SENTENCES_PER_LEVEL;
  const listenPercent =
    totalPossible > 0
      ? Math.round((totalListened / totalPossible) * 100)
      : 0;

  // Shadow aggregate
  const totalRecordings = shadowHistory.length;
  const avgAccuracy =
    totalRecordings > 0
      ? Math.round(
          shadowHistory.reduce((s, e) => s + e.grade.accuracy, 0) /
            totalRecordings
        )
      : 0;
  const avgFluency =
    totalRecordings > 0
      ? Math.round(
          shadowHistory.reduce((s, e) => s + e.grade.fluency, 0) /
            totalRecordings
        )
      : 0;

  // Shadow by level
  const shadowByLevel: Record<
    "N5" | "N4" | "N3",
    { count: number; sumAcc: number }
  > = {
    N5: { count: 0, sumAcc: 0 },
    N4: { count: 0, sumAcc: 0 },
    N3: { count: 0, sumAcc: 0 },
  };
  for (const e of shadowHistory) {
    const lvl = difficultyOf(e.sentenceId);
    if (lvl) {
      shadowByLevel[lvl].count++;
      shadowByLevel[lvl].sumAcc += e.grade.accuracy;
    }
  }

  // Shadow by category
  const shadowByCategory: Record<
    string,
    { count: number; sumAcc: number; sumFlu: number }
  > = {};
  for (const e of shadowHistory) {
    if (!shadowByCategory[e.categoryId]) {
      shadowByCategory[e.categoryId] = {
        count: 0,
        sumAcc: 0,
        sumFlu: 0,
      };
    }
    shadowByCategory[e.categoryId].count++;
    shadowByCategory[e.categoryId].sumAcc += e.grade.accuracy;
    shadowByCategory[e.categoryId].sumFlu += e.grade.fluency;
  }

  // Best sentence (highest accuracy)
  const bestSentence =
    shadowHistory.length > 0
      ? shadowHistory.reduce(
          (b, e) =>
            e.grade.accuracy > (b?.grade.accuracy ?? -1) ? e : b,
          shadowHistory[0]
        )
      : null;

  const isEmpty = totalListened === 0 && totalRecordings === 0;

  return (
    <main className="min-h-screen flex flex-col px-6 py-8 max-w-3xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link href="/today" className="text-sm text-gray-500 hover:text-gray-900">
          ← 今日训练
        </Link>
        <Link
          href="/listening"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          听力训练 →
        </Link>
      </header>

      <h1 className="text-2xl font-bold mb-2">📊 学习进度</h1>
      <p className="text-sm text-gray-500 mb-6">
        听力完成度 + Shadow 跟读统计 + 按场景 / 难度分布。
      </p>

      {/* Total stats */}
      <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
        <h2 className="text-base font-semibold text-gray-800 mb-4">总览</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {totalListened}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              已听句数 / {totalPossible}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">
              {totalRecordings > 0 ? avgAccuracy : "—"}
            </div>
            <div className="text-xs text-blue-600 mt-1">Shadow 平均准</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-purple-700">
              {totalRecordings > 0 ? avgFluency : "—"}
            </div>
            <div className="text-xs text-purple-600 mt-1">Shadow 平均流</div>
          </div>
        </div>
        {totalListened > 0 && (
          <div className="mt-3 text-sm text-gray-600">
            听力完成度：
            <span className="font-bold text-gray-900">{listenPercent}%</span>（
            {totalListened} / {totalPossible}）
          </div>
        )}
      </section>

      {/* Listen completion by difficulty */}
      <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          听力完成度（按难度）
        </h2>
        <div className="space-y-3">
          {LEVELS.map((lvl) => {
            const listened = listenedByLevel[lvl];
            const pct = Math.round(
              (listened / TOTAL_SENTENCES_PER_LEVEL) * 100
            );
            return (
              <div key={lvl}>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="font-medium text-gray-700">{lvl}</span>
                  <span className="text-gray-500">
                    {listened} / {TOTAL_SENTENCES_PER_LEVEL} · {pct}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      pct === 100 ? "bg-green-500" : "bg-gray-900"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Shadow aggregate */}
      {totalRecordings > 0 && (
        <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Shadow 跟读 · 共 {totalRecordings} 条
          </h2>

          <div className="mb-5">
            <div className="text-sm text-gray-500 mb-2">按难度：</div>
            <div className="space-y-1 text-sm">
              {LEVELS.map((lvl) => {
                const { count, sumAcc } = shadowByLevel[lvl];
                if (count === 0) return null;
                const acc = Math.round(sumAcc / count);
                return (
                  <div
                    key={lvl}
                    className="flex items-center justify-between text-gray-700"
                  >
                    <span>{lvl}</span>
                    <span className="text-gray-500">
                      {count} 条 · 准 {acc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-5">
            <div className="text-sm text-gray-500 mb-2">按场景：</div>
            <div className="space-y-1 text-sm">
              {Object.entries(CATEGORY_LABELS).map(([catId, info]) => {
                const cat = shadowByCategory[catId];
                if (!cat || cat.count === 0) return null;
                const acc = Math.round(cat.sumAcc / cat.count);
                const flu = Math.round(cat.sumFlu / cat.count);
                return (
                  <div
                    key={catId}
                    className="flex items-center justify-between text-gray-700"
                  >
                    <span>
                      {info.emoji} {info.label}
                    </span>
                    <span className="text-gray-500">
                      {cat.count} 条 · 准 {acc} · 流 {flu}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {bestSentence && (
            <div className="text-sm text-gray-500 italic">
              最佳：{bestSentence.grade.accuracy} 分（{bestSentence.sentenceId}）
            </div>
          )}
        </section>
      )}

      {/* Recent recordings */}
      {shadowHistory.length > 0 && (
        <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            最近录音 · 最近 {Math.min(5, shadowHistory.length)} 条
          </h2>
          <div className="space-y-2 text-sm">
            {shadowHistory.slice(0, 5).map((e) => {
              const lvl = difficultyOf(e.sentenceId);
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl p-3 gap-3"
                >
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-xs text-gray-500 font-mono">
                      {formatTime(e.timestamp)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-700 font-bold">
                        {e.grade.accuracy}
                      </span>
                      <span className="text-gray-300">/</span>
                      <span className="text-purple-700 font-bold">
                        {e.grade.fluency}
                      </span>
                    </div>
                    {lvl && (
                      <span className="text-xs text-gray-400">{lvl}</span>
                    )}
                  </div>
                  <div
                    className="text-xs text-gray-500 truncate min-w-0"
                    lang="ja"
                  >
                    {e.transcript ? (
                      e.transcript
                    ) : (
                      <span className="italic text-gray-400">(空白)</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {isEmpty && (
        <section className="border border-gray-200 rounded-2xl p-8 bg-white text-center">
          <div className="text-3xl mb-3">🌱</div>
          <div className="text-base font-medium text-gray-800 mb-2">
            还没有数据
          </div>
          <div className="text-sm text-gray-500">
            去{" "}
            <Link href="/listening" className="text-blue-600 underline">
              听力训练
            </Link>{" "}
            或{" "}
            <Link href="/speaking" className="text-blue-600 underline">
              口语训练
            </Link>{" "}
            开始练习，统计会在这里累积。
          </div>
        </section>
      )}

      <div className="mt-6 text-xs text-gray-400 text-center">
        数据来自 localStorage · 不同设备 / 浏览器之间不同步
      </div>
    </main>
  );
}