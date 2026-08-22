// /progress — learning dashboard.
//
// Server Component shell (this file) — pulls Supabase-backed mastery
// data and renders the new data-viz sections (分布直方图、按 JLPT 等级
// 掌握度、最需复习 / 已掌握 Top 10).
//
// Client Component (./client-progress.tsx) — owns the pre-existing
// localStorage-backed sections (overview / listening completion /
// shadow / recent recordings / weakness profile / empty state).
// Rendered as a child here so Server Component can stay server-side.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getMasteryByLevel,
  getMasteryDistribution,
  getMasteryStats,
  getVocabByMastery,
  type MasteryDistribution,
  type MasteryByLevel,
  type MasteryStats,
  type VocabWithMastery,
} from "@/lib/vocabulary/analytics";
import { ClientProgress } from "./client-progress";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Middleware (PROTECTED_PREFIXES) already redirects unauthenticated
  // users to /login, so `user` should always be set when we reach here.
  // Defensive null-check just in case the middleware was bypassed.
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <Link href="/login" className="text-blue-600 underline">
          去登录
        </Link>
      </main>
    );
  }

  // Fan out the 4 queries in parallel — single round-trip wall time.
  const [distribution, stats, byLevel, hardest, mastered] = await Promise.all([
    getMasteryDistribution(user.id),
    getMasteryStats(user.id),
    getMasteryByLevel(user.id),
    getVocabByMastery(user.id, "low", 10),
    getVocabByMastery(user.id, "high", 10),
  ]);

  return (
    <main className="min-h-screen flex flex-col px-6 py-8 max-w-3xl mx-auto">
      {/* Frank #6671 (UI优化.docx): drop both "← 今日训练" + "听力训练 →"
          nav links — /today page is removed and Frank doesn't want the
          nav clutter on /progress. */}
      <div className="mb-6" />

      <h1 className="text-2xl font-bold mb-2">📊 学习进度</h1>
      <p className="text-sm text-gray-500 mb-6">
        词汇 mastery + 听力完成度 + Shadow 跟读统计 + 按场景 / 难度分布。
      </p>

      {/* Mastery Stats Overview + Distribution Histogram + By JLPT */}
      {stats.total > 0 && (
        <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            🎯 词汇掌握度
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard label="总词数" value={stats.total} />
            <StatCard
              label="平均掌握"
              value={`${stats.avg}%`}
              tone="blue"
            />
            <StatCard
              label="已掌握"
              value={stats.mastered}
              tone="green"
              sub={`≥ ${MASTERED_THRESHOLD}`}
            />
            <StatCard
              label="待复习"
              value={stats.needsReview}
              tone="red"
              sub={`< ${REVIEW_THRESHOLD}`}
            />
          </div>

          <div className="mb-2 text-xs text-gray-500">掌握度分布：</div>
          <DistributionChart distribution={distribution} />

          {byLevel.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs text-gray-500">
                按 JLPT 等级：
              </div>
              <div className="space-y-2">
                {byLevel.map((b) => (
                  <LevelBar key={b.level} data={b} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Needs Review + Top Mastered */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <MasteryList title="📌 最需复习" items={hardest} />
          <MasteryList title="✨ 已掌握" items={mastered} />
        </div>
      )}

      {/* Existing localStorage-backed sections */}
      <ClientProgress />
    </main>
  );
}

const MASTERED_THRESHOLD = 80;
const REVIEW_THRESHOLD = 50;

function StatCard({
  label,
  value,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "blue" | "green" | "red";
  sub?: string;
}) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 border-green-200 text-green-700"
      : tone === "red"
        ? "bg-red-50 border-red-200 text-red-700"
        : tone === "blue"
          ? "bg-blue-50 border-blue-200 text-blue-700"
          : "bg-gray-50 border-gray-200 text-gray-900";
  return (
    <div
      className={`border rounded-xl p-3 text-center ${toneClass}`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
      {sub && <div className="text-[10px] mt-0.5 opacity-60">{sub}</div>}
    </div>
  );
}

function DistributionChart({
  distribution,
}: {
  distribution: MasteryDistribution[];
}) {
  const max = Math.max(1, ...distribution.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      {distribution.map((d) => {
        const pct = (d.count / max) * 100;
        // Color encodes mastery level: red (struggling) → yellow
        // (mid) → green (mastered). 80+ buckets = mastered territory.
        const color =
          d.bucket >= 80
            ? "bg-green-500"
            : d.bucket >= 50
              ? "bg-yellow-500"
              : "bg-red-400";
        const label =
          d.bucket === 90 ? "90-100" : `${d.bucket}-${d.bucket + 10}`;
        return (
          <div key={d.bucket} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-14 text-right tabular-nums">
              {label}
            </span>
            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
              <div
                className={`h-full ${color} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-8 text-right tabular-nums">
              {d.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LevelBar({ data }: { data: MasteryByLevel }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className="font-medium text-gray-700">{data.level}</span>
        <span className="text-gray-500 tabular-nums">
          {data.count} 词 · 掌握 {data.avg}%
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            data.avg >= MASTERED_THRESHOLD
              ? "bg-green-500"
              : data.avg >= REVIEW_THRESHOLD
                ? "bg-yellow-500"
                : "bg-gray-900"
          }`}
          style={{ width: `${data.avg}%` }}
        />
      </div>
    </div>
  );
}

function MasteryList({
  title,
  items,
}: {
  title: string;
  items: VocabWithMastery[];
}) {
  if (items.length === 0) {
    return (
      <section className="border border-gray-200 rounded-2xl p-5 bg-white">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
        <p className="text-sm text-gray-400">暂无数据</p>
      </section>
    );
  }
  return (
    <section className="border border-gray-200 rounded-2xl p-5 bg-white">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <Link
              href={`/vocabulary/${item.vocabulary_id}`}
              className="flex-1 truncate hover:underline"
            >
              <span className="font-medium text-gray-900">{item.word}</span>
              {item.reading && (
                <span className="text-xs text-gray-500 ml-1">
                  {item.reading}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.level && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                  {item.level}
                </span>
              )}
              <span
                className={`text-xs font-mono tabular-nums ${
                  item.mastery >= MASTERED_THRESHOLD
                    ? "text-green-600"
                    : item.mastery < REVIEW_THRESHOLD
                      ? "text-red-600"
                      : "text-gray-500"
                }`}
              >
                {item.mastery}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
