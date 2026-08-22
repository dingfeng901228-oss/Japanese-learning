// Daily training-progress tracking + real-time session timer (client-side,
// localStorage).
//
// Per Frank #6171 / #6175:
//   - DayProgress: today-keyed "completed items" + manual totalMinutes
//     (the user-check-in counter).
//   - DayAccumulated: today-keyed per-item actual training time, written
//     by the useSessionTimer hook when a training page unmounts.
//   - useSessionTimer: React hook for training pages. Tracks elapsed
//     time, updates state every second, and on unmount / pagehide
//     accumulates the minutes into DayAccumulated for the current
//     item type.
//   - getTimeUntilMidnight: countdown to end of day.
//
// All state auto-resets at midnight via the date-keyed localStorage
// keys (YYYY-MM-DD).

import { useEffect, useRef, useState } from "react";
import { enqueueSync, flushSync } from "@/lib/training-queue";

export type TrainingItemId = "listening" | "speaking" | "shadowing" | "review";

export type TrainingItemDef = {
  id: TrainingItemId;
  label: string;
  emoji: string;
  minutes: number;
  href: string;
};

// Order matters — this is the order the user sees on /today.
// Frank #6643: renamed 3rd item from "Shadowing" → "真人发音" + href points
// to the moved-from-/shadowing realShadow mode. id stays "shadowing" for
// localStorage backward compat (accumulated.minutes key didn't change).
// Note: the existing TTS-based shadow mode (2nd tab inside /listening) is
// no longer surfaced as a separate /today item — real-person audio is the
// canonical shadowing experience going forward.
export const TRAINING_ITEMS: TrainingItemDef[] = [
  { id: "listening", label: "听力", emoji: "🎧", minutes: 10, href: "/listening" },
  { id: "speaking", label: "口语", emoji: "🎤", minutes: 10, href: "/speaking" },
  { id: "shadowing", label: "真人发音", emoji: "🎧", minutes: 5, href: "/listening?mode=realShadow" },
  { id: "review", label: "复习", emoji: "📝", minutes: 5, href: "/review" },
];

export const TOTAL_TARGET_MINUTES = TRAINING_ITEMS.reduce(
  (s, i) => s + i.minutes,
  0
);

const STORAGE_KEY_PREFIX = "japaneseLearning.todayProgress.";
const ACCUMULATED_KEY_PREFIX = "japaneseLearning.accumulated.";
const ACTIVE_SESSION_KEY = "japaneseLearning.activeSession";

function todayKey(): string {
  // YYYY-MM-DD in local time (matches user's "today" intuition).
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type DayProgress = {
  date: string;
  completed: Partial<Record<TrainingItemId, true>>;
  totalMinutes: number;
};

export function loadDayProgress(): DayProgress {
  if (typeof window === "undefined") {
    return { date: todayKey(), completed: {}, totalMinutes: 0 };
  }
  const key = STORAGE_KEY_PREFIX + todayKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as DayProgress;
  } catch {
    // fall through to default
  }
  return { date: todayKey(), completed: {}, totalMinutes: 0 };
}

export function saveDayProgress(progress: DayProgress): void {
  if (typeof window === "undefined") return;
  const key = STORAGE_KEY_PREFIX + todayKey();
  try {
    window.localStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // Storage quota / private mode — silently ignore.
  }
}

export function toggleItem(id: TrainingItemId): DayProgress {
  const progress = loadDayProgress();
  if (progress.completed[id]) {
    delete progress.completed[id];
  } else {
    progress.completed[id] = true;
  }
  progress.totalMinutes = TRAINING_ITEMS.filter(
    (i) => progress.completed[i.id]
  ).reduce((s, i) => s + i.minutes, 0);
  saveDayProgress(progress);
  return progress;
}

// --- Real-time session accumulation -----------------------------------------

export type AccumulatedMap = Partial<Record<TrainingItemId, number>>;

export type DayAccumulated = {
  date: string;
  accumulated: AccumulatedMap;
};

export function loadAccumulated(): DayAccumulated {
  if (typeof window === "undefined") {
    return { date: todayKey(), accumulated: {} };
  }
  const key = ACCUMULATED_KEY_PREFIX + todayKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as DayAccumulated;
  } catch {
    // fall through to default
  }
  return { date: todayKey(), accumulated: {} };
}

export function saveAccumulated(acc: DayAccumulated): void {
  if (typeof window === "undefined") return;
  const key = ACCUMULATED_KEY_PREFIX + todayKey();
  try {
    window.localStorage.setItem(key, JSON.stringify(acc));
  } catch {
    // Storage quota — silently ignore.
  }
}

export function accumulateMinutes(
  type: TrainingItemId,
  minutes: number
): DayAccumulated {
  const acc = loadAccumulated();
  const prev = acc.accumulated[type] ?? 0;
  // Round to 2 decimal places to keep localStorage tidy.
  acc.accumulated[type] =
    Math.round((prev + minutes) * 100) / 100;
  saveAccumulated(acc);

  // Sync to daily_rollups via the localStorage-backed retry queue
  // (lib/training-queue.ts). Each call enqueues exactly one
  // (date, type, minutes) item; flushSync() drains and tries each
  // item against the recordDailyActivity server action. On failure
  // the item stays in the queue and use-daily-rollups.ts retries it
  // on every focus / visibilitychange / 5-min poll. The RPC
  // upsert_daily_rollup is additive, so as long as each item is
  // processed at most once retries are safe — and the queue's
  // drainQueue() removes items only after a successful server call.
  if (typeof window !== "undefined" && minutes > 0) {
    const delta = Math.round(minutes * 100) / 100;
    enqueueSync({
      date: todayKey(),
      type,
      minutes: delta,
      enqueuedAt: Date.now(),
    });
    flushSync().catch((err) => {
      console.error("sync flush failed (will retry on next focus):", err);
    });
  }

  return acc;
}

export type ActiveSession = {
  type: TrainingItemId;
  startedAt: number;
};

export function getActiveSession(): ActiveSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveSession;
  } catch {
    return null;
  }
}

export function setActiveSession(session: ActiveSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (session === null) {
      window.localStorage.removeItem(ACTIVE_SESSION_KEY);
    } else {
      window.localStorage.setItem(
        ACTIVE_SESSION_KEY,
        JSON.stringify(session)
      );
    }
  } catch {
    // Storage quota — silently ignore.
  }
}

// --- Real streak + week stats (localStorage-derived) ----------------------
//
// Per Frank #6219: streak + week stats should be real (from localStorage
// accumulated session data), not the mock 12/38 day values. All four
// TRAINING_ITEMS write to `japaneseLearning.accumulated.YYYY-MM-DD` via
// accumulateMinutes(), so we can scan the localStorage keyspace to find
// days with any activity.

export function getActiveTrainingDays(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const days = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(ACCUMULATED_KEY_PREFIX)) continue;
    const dateStr = key.slice(ACCUMULATED_KEY_PREFIX.length);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { accumulated: Record<string, number> };
      const total = Object.values(parsed.accumulated).reduce(
        (s, m) => s + m,
        0
      );
      if (total > 0) days.add(dateStr);
    } catch {
      // ignore corrupt keys
    }
  }
  return days;
}

export function computeStreakFromDays(days: Set<string>): {
  current: number;
  longest: number;
} {
  if (days.size === 0) return { current: 0, longest: 0 };

  const sorted = Array.from(days).sort();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = todayKey();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(
    yesterday.getMonth() + 1
  ).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  // Longest streak: walk sorted days, reset run when gap > 1.
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of sorted) {
    const dt = new Date(d + "T00:00:00");
    run =
      prev &&
      Math.round((dt.getTime() - prev.getTime()) / 86400000) === 1
        ? run + 1
        : 1;
    if (run > longest) longest = run;
    prev = dt;
  }

  // Current streak: only counts if the most-recent activity is today or
  // yesterday (so missing today doesn't immediately zero out the streak).
  let current = 0;
  const lastDay = sorted[sorted.length - 1];
  if (lastDay === todayStr || lastDay === yesterdayStr) {
    current = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const d1 = new Date(sorted[i + 1] + "T00:00:00");
      const d2 = new Date(sorted[i] + "T00:00:00");
      if (Math.round((d1.getTime() - d2.getTime()) / 86400000) === 1) {
        current++;
      } else {
        break;
      }
    }
  }

  return { current, longest };
}

export function getWeekStats(): { minutes: number; daysStudied: number } {
  if (typeof window === "undefined") return { minutes: 0, daysStudied: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let minutes = 0;
  let daysStudied = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(ACCUMULATED_KEY_PREFIX)) continue;
    const dateStr = key.slice(ACCUMULATED_KEY_PREFIX.length);
    const d = new Date(dateStr + "T00:00:00");
    if (d < weekAgo || d > today) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { accumulated: Record<string, number> };
      const total = Object.values(parsed.accumulated).reduce(
        (s, m) => s + m,
        0
      );
      if (total > 0) {
        minutes += total;
        daysStudied++;
      }
    } catch {
      // ignore
    }
  }
  return { minutes, daysStudied };
}

// React hook for the dashboard's weekly stats. Refreshes on focus and
// every 5s so the UI updates live as the user spends time in /listening
// / /speaking / /review.
export function useWeekStats(): { minutes: number; daysStudied: number } {
  const [stats, setStats] = useState<{ minutes: number; daysStudied: number }>(
    { minutes: 0, daysStudied: 0 }
  );
  useEffect(() => {
    function refresh() {
      setStats(getWeekStats());
    }
    refresh();
    window.addEventListener("focus", refresh);
    const id = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(id);
    };
  }, []);
  return stats;
}

// React hook for the dashboard's streak. Same refresh strategy as
// useWeekStats.
export function useStreak(): { current: number; longest: number } {
  const [streak, setStreak] = useState<{ current: number; longest: number }>({
    current: 0,
    longest: 0,
  });
  useEffect(() => {
    function refresh() {
      setStreak(computeStreakFromDays(getActiveTrainingDays()));
    }
    refresh();
    window.addEventListener("focus", refresh);
    const id = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(id);
    };
  }, []);
  return streak;
}

// React hook for tracking session time on a training page. Returns:
//   - elapsed: ms since the timer started (updates every second)
//   - running: true while the timer is active
//
// On unmount or pagehide (covers tab close + mobile app switch),
// accumulates elapsed minutes into DayAccumulated under `type`.
// Sub-second sessions are ignored to avoid noise from rapid back
// clicks.
//
// Per Frank #6522: pass `active` to only count when the user is
// actually engaged. Default true for backward compat. When `active`
// flips false → true, start a new segment; true → false, accumulate
// the in-progress segment into `accumulatedMs` and stop ticking.
// `elapsed` = accumulatedMs + (active ? now - segmentStart : 0).
export function useSessionTimer(
  type: TrainingItemId,
  active: boolean = true
): {
  elapsed: number;
  running: boolean;
} {
  const [elapsed, setElapsed] = useState(0);
  const accumulatedMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const activeRef = useRef(active);

  // Init on mount + cleanup on unmount (also handles type change).
  useEffect(() => {
    if (active) {
      segmentStartRef.current = Date.now();
      setActiveSession({ type, startedAt: Date.now() });
    } else {
      segmentStartRef.current = null;
    }

    return () => {
      const finalMs =
        accumulatedMsRef.current +
        (segmentStartRef.current !== null
          ? Date.now() - segmentStartRef.current
          : 0);
      setActiveSession(null);
      if (finalMs >= 1000) {
        accumulateMinutes(type, finalMs / 60000);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Handle active state changes (pause / resume).
  useEffect(() => {
    const wasActive = activeRef.current;
    if (wasActive === active) return;
    activeRef.current = active;

    if (active && !wasActive) {
      // Resume: start a new segment from now.
      segmentStartRef.current = Date.now();
    } else if (!active && wasActive) {
      // Pause: accumulate the in-progress segment into the buffer.
      if (segmentStartRef.current !== null) {
        accumulatedMsRef.current += Date.now() - segmentStartRef.current;
        segmentStartRef.current = null;
      }
    }
  }, [active]);

  // Tick interval — only when active. When active flips false the
  // interval is cleared by the cleanup below.
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => {
      const total =
        accumulatedMsRef.current +
        (segmentStartRef.current !== null
          ? Date.now() - segmentStartRef.current
          : 0);
      setElapsed(total);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  return { elapsed, running: active };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

// --- End-of-day countdown ---------------------------------------------------

export type CountdownParts = {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

export function getTimeUntilMidnight(): CountdownParts {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const totalMs = Math.max(0, end.getTime() - now.getTime());
  const hours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
  return { hours, minutes, seconds, totalMs };
}
