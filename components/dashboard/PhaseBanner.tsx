// Phase Banner — spec §18. Per audit 2026-10-09 P0-3: was a static
// decoration ("Phase 0 · 2026" + three aspirational sentences). Now it
// shows real progress toward the Phase 1 unlock criteria (a 30-day
// streak AND 300 saved vocab items) plus the three goals. This turns
// the bottom of the dashboard into something with a pulse instead of
// dead text.
//
// Audit 2026-11-16 P0-1: the streak used to be computed here from a
// hand-copied helper over daily_rollups while the streak counter above
// read the same table client-side — so the page showed both "最长连续
// 0 天" and "最长连续 15 / 30 天". Both now come from
// lib/vocabulary/stats.ts.
//
// The vocabulary metric is the number of SAVED words (that is what the
// Phase 1 unlock criterion counts), but it used to be labelled
// "已掌握词汇" — which claimed 3347 mastered words while the real
// mastery count is 0. It now says 已收藏 and shows the true 已掌握
// count next to it.

import Link from "next/link";
import { getActivityStats, getVocabStats } from "@/lib/vocabulary/stats";

const PHASE1_STREAK_TARGET = 30; // days
const PHASE1_VOCAB_TARGET = 300; // words

export async function PhaseBanner() {
  const [activity, stats] = await Promise.all([
    getActivityStats(),
    getVocabStats(),
  ]);
  const streakLongest = activity.longestStreak;
  const streakCurrent = activity.currentStreak;
  const vocabCount = stats.total;
  const masteredCount = stats.mastered;

  return (
    <Banner
      streak={streakLongest}
      vocab={vocabCount}
      mastered={masteredCount}
      currentStreak={streakCurrent}
    />
  );
}

function Banner({
  streak,
  vocab,
  mastered,
  currentStreak,
}: {
  streak: number;
  vocab: number;
  mastered: number;
  currentStreak?: number;
}) {
  const streakPct = Math.min(
    100,
    Math.round((streak / PHASE1_STREAK_TARGET) * 100)
  );
  const vocabPct = Math.min(
    100,
    Math.round((vocab / PHASE1_VOCAB_TARGET) * 100)
  );
  // "Composite progress" — average of the two milestones so the bar
  // doesn't jump to 100% on whichever metric is easiest. Both must
  // reach the target to unlock Phase 1.
  const overallPct = Math.round((streakPct + vocabPct) / 2);
  const unlocked =
    streak >= PHASE1_STREAK_TARGET && vocab >= PHASE1_VOCAB_TARGET;

  return (
    <section className="py-12 border-t border-line">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide">
          {unlocked ? "Phase 1 已解锁 · 继续推进" : "Phase 0 · 2026"}
        </p>
        <p className="text-xs text-gray-400 tabular-nums">
          {overallPct}% → Phase 1
        </p>
      </div>

      <h2 className="font-sc text-2xl font-bold text-ink mb-2">重新开始</h2>
      <ul className="font-jp text-gray-700 space-y-1 mt-4 text-lg">
        <li>日本語を学ぶ。</li>
        <li>日本で働く。</li>
        <li>新しい生活を作る。</li>
      </ul>

      {/* Progress block — only render when there's at least one nonzero
          metric. For a brand-new account (0/0/0) it just adds noise. */}
      {(streak > 0 || vocab > 0) && (
        <div className="mt-8 max-w-xl space-y-4">
          <Progress
            label={`最长连续学习 ${streak} / ${PHASE1_STREAK_TARGET} 天`}
            pct={streakPct}
            current={
              typeof currentStreak === "number" ? `🔥 ${currentStreak} 天` : null
            }
          />
          <Progress
            label={`已收藏词汇 ${vocab} / ${PHASE1_VOCAB_TARGET} 词`}
            pct={vocabPct}
          />
          {/* The real mastery count — the row above counts SAVED words,
              which is what the Phase 1 unlock criterion is about. */}
          <Progress
            label={`已掌握 ${mastered} 词（掌握度 ≥ 80%）`}
            pct={
              mastered > 0
                ? Math.min(100, Math.round((mastered / Math.max(1, vocab)) * 100))
                : 0
            }
          />
        </div>
      )}

      {/* Empty-state nudge — shown only when both metrics are zero
          (account exists, no training yet). Pure dashboard new-user
          affordance; not duplicated for them by the hero CTAs. */}
      {streak === 0 && vocab === 0 && (
        <p className="mt-6 text-sm text-gray-400">
          还没有学习记录。
          <Link href="/vocabulary/new" className="text-ink hover:underline ml-1">
            添加第一个词
          </Link>
          ，开始 Phase 0 的第一步。
        </p>
      )}
    </section>
  );
}

function Progress({
  label,
  pct,
  current,
}: {
  label: string;
  pct: number;
  current?: string | null;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <p className="text-sm text-gray-700 tabular-nums">{label}</p>
        {current && (
          <p className="text-sm text-gray-500 tabular-nums">{current}</p>
        )}
      </div>
      <div
        className="h-1.5 rounded-full bg-gray-200 overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-ink rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}