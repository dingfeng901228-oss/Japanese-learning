"use client";

// /progress — localStorage-backed sections (listening + shadow stats).
// The Server Component parent (page.tsx) handles the new mastery data
// viz section (Supabase-backed); this Client Component handles the
// pre-existing localStorage-backed overview / listening / shadow /
// recent-recording / weakness-profile sections, plus the empty state
// when there's no localStorage data yet.
//
// Splitting out as a Client Component so the parent can stay as a
// Server Component and fetch mastery data directly from Supabase.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  type Difficulty,
  LEVELS,
  CATEGORY_LABELS,
  TOTAL_SENTENCES_PER_LEVEL,
  difficultyOf,
} from "@/lib/sentences";
import { WeaknessProfile } from "@/components/dashboard/WeaknessProfile";

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
const PROGRESS_KEY = "japaneseLearning.listeningProgress";
const SHADOW_HISTORY_KEY = "japaneseLearning.shadowHistory";

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
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ClientProgress() {
  const [progress, setProgress] = useState<Record<string, Set<string>>>({});
  const [shadowHistory, setShadowHistory] = useState<ShadowHistoryEntry[]>([]);

  useEffect(() => {
    setProgress(loadProgress());
    setShadowHistory(loadShadowHistory());
  }, []);

  const totalListened = Object.values(progress).reduce(
    (s, set) => s + set.size,
    0
  );
  const listenedByLevel: Record<Difficulty, number> = {
    N5: 0,
    N4: 0,
    N3: 0,
    N2: 0,
    N1: 0,
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

  const shadowByLevel: Record<
    Difficulty,
    { count: number; sumAcc: number }
  > = {
    N5: { count: 0, sumAcc: 0 },
    N4: { count: 0, sumAcc: 0 },
    N3: { count: 0, sumAcc: 0 },
    N2: { count: 0, sumAcc: 0 },
    N1: { count: 0, sumAcc: 0 },
  };
  for (const e of shadowHistory) {
    const lvl = difficultyOf(e.sentenceId);
    if (lvl) {
      shadowByLevel[lvl].count++;
      shadowByLevel[lvl].sumAcc += e.grade.accuracy;
    }
  }

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
    <>
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

      {/* Weakness profile */}
      {!isEmpty &&
        (() => {
          const byCategory: Record<string, { sum: number; count: number }> = {};
          for (const e of shadowHistory) {
            if (!byCategory[e.categoryId])
              byCategory[e.categoryId] = { sum: 0, count: 0 };
            byCategory[e.categoryId].sum += e.grade.accuracy;
            byCategory[e.categoryId].count += 1;
          }
          const weaknessRanking = Object.entries(byCategory)
            .map(([cat, stats]) => ({
              categoryId: cat,
              avg: stats.sum / stats.count,
              count: stats.count,
            }))
            .sort((a, b) => a.avg - b.avg)
            .slice(0, 3);

          if (weaknessRanking.length === 0) return null;

          const trend =
            shadowHistory.length >= 4
              ? (() => {
                  const sorted = [...shadowHistory].sort(
                    (a, b) => a.timestamp - b.timestamp
                  );
                  const mid = Math.floor(sorted.length / 2);
                  const avgAcc = (arr: typeof sorted) =>
                    arr.length > 0
                      ? arr.reduce((s, e) => s + e.grade.accuracy, 0) /
                        arr.length
                      : 0;
                  const firstAvg = avgAcc(sorted.slice(0, mid));
                  const secondAvg = avgAcc(sorted.slice(mid));
                  return {
                    firstAvg,
                    secondAvg,
                    delta: secondAvg - firstAvg,
                  };
                })()
              : null;

          return (
            <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
              <h2 className="text-base font-semibold text-gray-800 mb-4">
                弱點档案
              </h2>

              <div className="mb-5">
                <div className="text-sm text-gray-500 mb-2">
                  最弱 3 个场景：
                </div>
                <div className="space-y-2">
                  {weaknessRanking.map((w) => {
                    const cat = CATEGORY_LABELS[w.categoryId];
                    return (
                      <div
                        key={w.categoryId}
                        className="flex items-center justify-between bg-gray-50 rounded-xl p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {cat?.emoji ?? "❓"}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {cat?.label ?? w.categoryId}
                          </span>
                          <span className="text-xs text-gray-400">
                            {w.count} 次
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-red-600">
                            准 {Math.round(w.avg)}
                          </span>
                          <Link
                            href={`/listening?c=${w.categoryId}`}
                            className="text-xs text-gray-500 hover:text-gray-900"
                          >
                            去练习 →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {trend && (
                <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
                  <span className="text-gray-500">改进趋势：</span>{" "}
                  前半 {Math.round(trend.firstAvg)} → 后半{" "}
                  {Math.round(trend.secondAvg)}
                  {trend.delta > 0 ? (
                    <span className="text-green-600 ml-1">
                      ↑{Math.round(trend.delta)}
                    </span>
                  ) : trend.delta < 0 ? (
                    <span className="text-red-600 ml-1">
                      ↓{Math.abs(Math.round(trend.delta))}
                    </span>
                  ) : (
                    <span className="text-gray-500 ml-1">持平</span>
                  )}
                </div>
              )}
            </section>
          );
        })()}

      {/* 最近弱点 + 常见错误 Top 10 (moved here from /today per Frank #6615).
         Sourced from localStorage mistake history; renders its own empty
         state when there's no history yet, so safe to mount unconditionally. */}
      <WeaknessProfile />

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
    </>
  );
}
