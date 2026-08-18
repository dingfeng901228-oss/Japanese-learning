"use client";

// /today — daily training dashboard.
//
// Phase 1.5: per Frank #6171, the Today's Goal section now has:
//   1. End-of-day countdown ("距离今天结束还有 X 小时 Y 分钟")
//   2. Completion check-in progress bar (X / 30 分钟)
//   3. ✓ buttons next to each training item so the user can "打卡"
// The state is date-keyed in localStorage (resets at midnight).
//
// The pre-existing localStorage-backed sections (listening / shadow /
// recent recordings / weakness profile / empty state) are unchanged.

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  TRAINING_ITEMS,
  TOTAL_TARGET_MINUTES,
  loadDayProgress,
  saveDayProgress,
  toggleItem as toggleItemStorage,
  getTimeUntilMidnight,
  type DayProgress,
  type CountdownParts,
  type TrainingItemId,
} from "@/lib/today-stats";

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
const SHADOW_HISTORY_KEY = "japaneseLearning.shadowHistory";

const SHADOW_CATEGORY_LABELS: Record<
  string,
  { emoji: string; label: string }
> = {
  "self-intro": { emoji: "🙋", label: "自我介绍" },
  restaurant: { emoji: "🍱", label: "餐厅" },
  directions: { emoji: "🗺️", label: "问路" },
  "numbers-time": { emoji: "⏰", label: "数字时间" },
  greetings: { emoji: "👋", label: "寒暄" },
};

type RealWorldMission = {
  id: string;
  categoryId: string;
  emoji: string;
  title: string;
  description: string;
};

const REAL_WORLD_MISSIONS: RealWorldMission[] = [
  {
    id: "m-self-intro-1",
    categoryId: "self-intro",
    emoji: "🙋",
    title: "用日语做 1 分钟自我介绍",
    description:
      "用日语做一次 1 分钟自我介绍录音。可以在 /listening 复习 🙋 类别的句子。",
  },
  {
    id: "m-self-intro-2",
    categoryId: "self-intro",
    emoji: "🙋",
    title: "向朋友介绍自己",
    description: "用日语向朋友介绍自己（姓名、职业、爱好）。",
  },
  {
    id: "m-restaurant-1",
    categoryId: "restaurant",
    emoji: "🍱",
    title: "用日语点一份餐",
    description: "试着在餐厅用日语点一份餐。用 /listening 复习 🍱 类别句子。",
  },
  {
    id: "m-restaurant-2",
    categoryId: "restaurant",
    emoji: "🍱",
    title: "用日语问推荐",
    description: "用日语问服务员推荐什么菜（'おすすめは何ですか'）。",
  },
  {
    id: "m-directions-1",
    categoryId: "directions",
    emoji: "🗺️",
    title: "用日语问路",
    description: "试着在路上用日语问路。用 /listening 复习 🗺️ 类别句子。",
  },
  {
    id: "m-directions-2",
    categoryId: "directions",
    emoji: "🗺️",
    title: "用日语说方向",
    description:
      "用日语告诉别人怎么走（'まっすぐ行って、右に曲がって'）。",
  },
  {
    id: "m-numbers-time-1",
    categoryId: "numbers-time",
    emoji: "⏰",
    title: "用日语报时间",
    description: "用日语报出当前时间（'今、何時ですか' + 数字）。",
  },
  {
    id: "m-numbers-time-2",
    categoryId: "numbers-time",
    emoji: "⏰",
    title: "用日语报日期",
    description: "用日语报出今天的日期（'今日は何日ですか' + 日期）。",
  },
  {
    id: "m-greetings-1",
    categoryId: "greetings",
    emoji: "👋",
    title: "用日语跟朋友打招呼",
    description:
      "用日语跟朋友打招呼（'おはようございます' / 'こんにちは'）。",
  },
  {
    id: "m-greetings-2",
    categoryId: "greetings",
    emoji: "👋",
    title: "用日语告别",
    description: "用日语跟朋友告别（'また明日' / 'また会いましょう'）。",
  },
];

type ShadowHistoryEntry = {
  id: string;
  sentenceId: string;
  categoryId: string;
  timestamp: number;
  transcript: string;
  grade: { accuracy: number; fluency: number; feedback: string; suggestions: string[]; encouragement: string };
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMistakeTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

function computeStreak(history: { timestamp: number }[]): number {
  if (history.length === 0) return 0;

  const formatDay = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const trainingDays = new Set<string>();
  for (const entry of history) {
    trainingDays.add(formatDay(new Date(entry.timestamp)));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let checkDate = new Date(today);
  if (!trainingDays.has(formatDay(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;
  while (trainingDays.has(formatDay(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}

export default function TodayPage() {
  const [history, setHistory] = useState<MistakeEntry[]>([]);
  const [shadowHistory, setShadowHistory] = useState<ShadowHistoryEntry[]>([]);
  const [missionCompletions, setMissionCompletions] = useState<
    Record<string, number>
  >({});

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SHADOW_HISTORY_KEY);
      setShadowHistory(
        raw ? (JSON.parse(raw) as ShadowHistoryEntry[]) : []
      );
    } catch {
      setShadowHistory([]);
    }
  }, []);

  // Phase 1.5: time-of-day greeting, set on mount to avoid hydration mismatch.
  const [greeting, setGreeting] = useState<string>("");
  useEffect(() => {
    setGreeting(getTimeBasedGreeting());
  }, []);

  // Phase 1.5: end-of-day countdown (per Frank #6171).
  const [countdown, setCountdown] = useState<CountdownParts>(() =>
    getTimeUntilMidnight()
  );
  useEffect(() => {
    setCountdown(getTimeUntilMidnight());
    const id = window.setInterval(() => {
      setCountdown(getTimeUntilMidnight());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Phase 1.5: today's training check-in progress (per Frank #6171).
  const [dayProgress, setDayProgress] = useState<DayProgress>(() => ({
    date: "",
    completed: {},
    totalMinutes: 0,
  }));
  useEffect(() => {
    setDayProgress(loadDayProgress());
  }, []);
  function handleToggleItem(id: TrainingItemId) {
    const next = toggleItemStorage(id);
    setDayProgress(next);
  }

  // Phase 11: real consecutive training days from shadow history timestamps.
  const streakDays = useMemo(
    () => computeStreak(shadowHistory),
    [shadowHistory]
  );

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

  const weakShadowSentences = (() => {
    const WEAK_THRESHOLD = 80;
    const map = new Map<
      string,
      {
        sentenceId: string;
        categoryId: string;
        accuracy: number;
        timestamp: number;
      }
    >();
    for (const e of shadowHistory) {
      if (e.grade.accuracy >= WEAK_THRESHOLD) continue;
      const existing = map.get(e.sentenceId);
      if (!existing || e.grade.accuracy < existing.accuracy) {
        map.set(e.sentenceId, {
          sentenceId: e.sentenceId,
          categoryId: e.categoryId,
          accuracy: e.grade.accuracy,
          timestamp: e.timestamp,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);
  })();

  const weakestCategory = (() => {
    const MIN_SAMPLES = 2;
    const byCat: Record<string, { sum: number; count: number }> = {};
    for (const e of shadowHistory) {
      if (!byCat[e.categoryId]) byCat[e.categoryId] = { sum: 0, count: 0 };
      byCat[e.categoryId].sum += e.grade.accuracy;
      byCat[e.categoryId].count += 1;
    }
    let worst: {
      categoryId: string;
      avg: number;
      count: number;
    } | null = null;
    for (const [cat, stats] of Object.entries(byCat)) {
      if (stats.count < MIN_SAMPLES) continue;
      const avg = stats.sum / stats.count;
      if (!worst || avg < worst.avg) {
        worst = { categoryId: cat, avg, count: stats.count };
      }
    }
    return worst;
  })();

  const recentItems = allItems
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10);

  const topMistakes = aggregateMistakes(history);

  const sessionCount = history.length;

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← 返回
          </Link>
          <Link
            href="/progress"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            📊 进度
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-4">FastStudy 2.0</p>
        <h1 className="text-3xl font-bold mt-1">今日训练</h1>
        <p className="text-gray-600 mt-2">
          {greeting && `${greeting}. `}
          <span className="text-gray-400">
            {streakDays > 0
              ? `连续训练 ${streakDays} 天 🔥`
              : "开始训练，记录你的连续天数"}
          </span>
        </p>

        {/* Phase 1.5: end-of-day countdown (per Frank #6171). */}
        <p
          className="mt-3 text-sm text-gray-500 tabular-nums"
          aria-live="polite"
        >
          � 距离今天结束还有{" "}
          <span className="font-semibold text-gray-700">
            {countdown.hours.toString().padStart(2, "0")}:
            {countdown.minutes.toString().padStart(2, "0")}:
            {countdown.seconds.toString().padStart(2, "0")}
          </span>
        </p>
      </header>

      <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8">
        <div className="text-sm text-gray-500 mb-2">Today's Goal</div>
        <h2 className="text-2xl font-bold mb-2">约 30 分钟</h2>

        {/* Phase 1.5: completion check-in progress bar (per Frank #6171).
            Fills as the user ticks the ✓ buttons next to each item. */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1 text-xs">
            <span className="text-gray-500">
              完成 {dayProgress.totalMinutes} / {TOTAL_TARGET_MINUTES} 分钟
            </span>
            <span className="text-gray-500 tabular-nums">
              {Math.round(
                (dayProgress.totalMinutes / TOTAL_TARGET_MINUTES) * 100
              )}
              %
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                dayProgress.totalMinutes >= TOTAL_TARGET_MINUTES
                  ? "bg-green-500"
                  : "bg-gray-900"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  (dayProgress.totalMinutes / TOTAL_TARGET_MINUTES) * 100
                )}%`,
              }}
              role="progressbar"
              aria-valuenow={dayProgress.totalMinutes}
              aria-valuemin={0}
              aria-valuemax={TOTAL_TARGET_MINUTES}
            />
          </div>
        </div>

        <ul className="space-y-3">
          {TRAINING_ITEMS.map((item) => {
            const done = !!dayProgress.completed[item.id];
            return (
              <li key={item.id} className="flex items-center gap-2">
                <Link
                  href={item.href}
                  className="flex-1 flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className={done ? "text-gray-400 line-through" : ""}>
                    {item.emoji} {item.label}
                  </span>
                  <span className="text-sm text-gray-500">
                    {item.minutes} 分钟 →
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleToggleItem(item.id)}
                  aria-label={done ? `取消打卡 ${item.label}` : `打卡 ${item.label}`}
                  aria-pressed={done}
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors ${
                    done
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  {done ? "✓" : "○"}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-gray-400 text-center mt-6">
          点左侧进入训练，完成后点右侧 ○ 打卡（自动累加时间到进度条）。
        </p>
      </div>

      {/* Phase 7 enhancement: 今日重点 (Daily Training Engine)
         Picks the weakest category from Shadow history + deep-link to /listening. */}
      {weakestCategory && (
        <section className="mb-8 p-5 rounded-2xl border-2 border-gray-900 bg-gray-50">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">
            今日重点
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {SHADOW_CATEGORY_LABELS[weakestCategory.categoryId]?.emoji ??
                  "❓"}
              </span>
              <div>
                <div className="text-base font-bold text-gray-900">
                  {SHADOW_CATEGORY_LABELS[weakestCategory.categoryId]?.label ??
                    weakestCategory.categoryId}
                </div>
                <div className="text-xs text-gray-500">
                  平均准 {Math.round(weakestCategory.avg)} · 共{" "}
                  {weakestCategory.count} 次练习
                </div>
              </div>
            </div>
            <Link
              href={`/listening?c=${weakestCategory.categoryId}`}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors flex-shrink-0"
            >
              去训练 →
            </Link>
          </div>
        </section>
      )}

      {/* Phase 9 enhancement: Real-World Missions */}
      <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">🌍 Real-World Missions</h2>
          <span className="text-xs text-gray-500">
            {Object.keys(missionCompletions).length}/
            {REAL_WORLD_MISSIONS.length} 完成
          </span>
        </div>
        <div className="space-y-2">
          {REAL_WORLD_MISSIONS.map((m) => {
            const isDone = !!missionCompletions[m.id];
            return (
              <div
                key={m.id}
                className={`flex items-start gap-3 rounded-xl p-3 ${
                  isDone
                    ? "bg-green-50 border border-green-200"
                    : "bg-gray-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...missionCompletions };
                    if (next[m.id]) delete next[m.id];
                    else next[m.id] = Date.now();
                    setMissionCompletions(next);
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(
                        "japaneseLearning.missionCompletions",
                        JSON.stringify(next)
                      );
                    }
                  }}
                  className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center mt-0.5 ${
                    isDone
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  title={isDone ? "标记为未完成" : "标记为完成"}
                >
                  {isDone && "✓"}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{m.emoji}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {m.title}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{m.description}</div>
                  {isDone && missionCompletions[m.id] && (
                    <div className="text-xs text-green-600 mt-1">
                      ✓ 完成于{" "}
                      {new Date(missionCompletions[m.id]).toLocaleString(
                        "zh-CN"
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

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

      {/* Phase 4 enhancement: Shadow 弱點句子
         (sentences user got < 80% accuracy in Shadow mode) */}
      {weakShadowSentences.length > 0 && (
        <section className="mt-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Shadow 弱點句子
            <span className="ml-2 text-xs text-gray-400 normal-case font-normal">
              （准确度 &lt; 80 ·{" "}
              {weakShadowSentences.length === 1
                ? "1 句"
                : `${weakShadowSentences.length} 句`}
              待巩固）
            </span>
          </h3>
          <div className="space-y-2">
            {weakShadowSentences.map((w) => {
              const cat = SHADOW_CATEGORY_LABELS[w.categoryId];
              return (
                <div
                  key={w.sentenceId}
                  className="flex items-center justify-between bg-gray-50 rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {cat?.emoji ?? "❓"}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        {cat?.label ?? w.categoryId}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {w.sentenceId}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-red-600">
                      准 {w.accuracy}
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
        </section>
      )}

      {/* Phase 1 enhancement #3: 错误时间线 (recent mistakes with timestamps) */}
      {history.length > 0 && (
        <section className="mt-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            错误时间线
            <span className="ml-2 text-xs text-gray-400 normal-case font-normal">
              （最近 {Math.min(15, history.length)} 条 · 共 {history.length}）
            </span>
          </h3>
          <div className="space-y-2">
            {history.slice(0, 15).map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 text-sm bg-gray-50 rounded-xl p-3"
              >
                <span className="text-xs text-gray-500 font-mono flex-shrink-0 w-24">
                  {formatMistakeTime(m.timestamp)}
                </span>
                <span
                  className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                    m.grammar.length > 0
                      ? "bg-red-50 text-red-600"
                      : "bg-blue-50 text-blue-600"
                  }`}
                >
                  {m.grammar.length > 0 ? "语法" : "词汇"}
                </span>
                <span className="text-gray-700 truncate flex-1">
                  {m.grammar[0] || m.vocabulary[0] || "(空)"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

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
