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

export type TrainingItemId = "listening" | "speaking" | "vocab";

export type TrainingItemDef = {
  id: TrainingItemId;
  label: string;
  emoji: string;
  minutes: number;
  href: string;
};

// Frank #6671 (UI优化.docx): the daily 学習 module now shows just
// three items, with data sources aligned to the spec:
//   听力 = /listening page time (Listen + Shadow + 真人发音 modes all
//          roll up into this single bucket — the old "shadowing" id is
//          gone, its localStorage history migrates automatically since
//          the label only changed in code).
//   口语 = /speaking page time (unchanged).
//   词汇 = /vocabulary (any detail page) + /review page time (combined
//          into the new "vocab" id — /review previously used the
//          "review" id; old history stays under that key for users who
//          don't re-train).
export const TRAINING_ITEMS: TrainingItemDef[] = [
  { id: "listening", label: "听力", emoji: "🎧", minutes: 10, href: "/listening" },
  { id: "speaking", label: "口语", emoji: "🎤", minutes: 10, href: "/speaking" },
  { id: "vocab", label: "词汇", emoji: "📚", minutes: 10, href: "/vocabulary" },
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
//   - running: true while the timer is actively counting (active && !capped)
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
//
// Per Frank #6671 (UI优化.docx): add per-segment cap support so
// /vocabulary/[id] can cap at 5s/word and /review can cap at 10s/question.
// `maxMsPerSegment` = single segment budget. When segmentElapsed
// reaches the cap, the segment freezes (accumulatedMs += cap,
// segmentStartRef = null) and `running` flips to false — no more
// accumulation until either `active` flips back to true (manual
// resume) or `segmentKey` changes (new item). Default undefined =
// no cap (backward compat with /listening, /speaking, /shadowing).
export function useSessionTimer(
  type: TrainingItemId,
  active: boolean = true,
  options?: { maxMsPerSegment?: number; segmentKey?: string }
): {
  elapsed: number;
  running: boolean;
} {
  const { maxMsPerSegment, segmentKey } = options ?? {};
  const [elapsed, setElapsed] = useState(0);
  // `running` is now internal state — it can differ from `active`
  // when the cap is reached (active=true, running=false). UI can
  // use this to show "(已暂停)" hint without exposing the active
  // prop to the consumer.
  const [running, setRunning] = useState(active);
  const accumulatedMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const activeRef = useRef(active);

  // Per Frank #6690 + #6692 + docs/计时规则.docx: per-item timer.
  // When `segmentKey` is provided, we PERSIST the accumulated time to
  // localStorage so the same item's timer continues across navigations
  // (user can leave and come back, timer resumes from stored value).
  // When the user switches to a DIFFERENT item, the new item starts
  // fresh from 0 (each item has independent accumulator per docx §关键
  // 澄清: "新词是独立的累加计数器，不是接着上一个词的秒数走").
  //
  // localStorage is per-tab/per-browser and survives page reloads. The
  // docx doesn't require cross-reload persistence, but localStorage is
  // the simplest in-tab persistence layer available.
  //
  // Callers that DON'T pass `segmentKey` (/listening / /speaking /
  // /shadowing per #6692) keep the old behavior: accumulate from
  // mount to unmount, no per-item persistence.
  const persistKey = segmentKey
    ? `japanese:item-timer:${segmentKey}`
    : null;

  function readStored(): number {
    if (!persistKey || typeof window === "undefined") return 0;
    try {
      const raw = localStorage.getItem(persistKey);
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as { accumulated?: number };
      return typeof parsed.accumulated === "number" ? parsed.accumulated : 0;
    } catch {
      return 0;
    }
  }

  function writeStored(value: number): void {
    if (!persistKey || typeof window === "undefined") return;
    try {
      localStorage.setItem(
        persistKey,
        JSON.stringify({ accumulated: value })
      );
    } catch {
      // quota / private mode — silently ignore
    }
  }

  // Init on mount + on type OR segmentKey change + cleanup on unmount.
  //
  // Per-item cumulative (Frank #6692 + docs/计时规则.docx):
  //   1. On setup: read the previous accumulated time for this
  //      segmentKey from localStorage. accumulatedMsRef starts there.
  //   2. Start a fresh segmentStartRef so the cap check measures only
  //      THIS visit's elapsed (cap is per-segment, not per-item).
  //   3. On cleanup (unmount OR segmentKey change): save the current
  //      total accumulated (stored + this segment's elapsed) back to
  //      localStorage for next visit.
  //   4. Commit only the SESSION DELTA to daily_rollups — the stored
  //      amount was already counted when it was first accumulated (so
  //      no double counting across visits).
  useEffect(() => {
    const storedAccumulated = readStored();
    accumulatedMsRef.current = storedAccumulated;

    const atCap =
      maxMsPerSegment !== undefined && storedAccumulated >= maxMsPerSegment;

    if (active && !atCap) {
      segmentStartRef.current = Date.now();
      setActiveSession({ type, startedAt: Date.now() });
      setRunning(true);
    } else {
      segmentStartRef.current = null;
      setActiveSession(null);
      setRunning(false);
    }
    setElapsed(storedAccumulated);

    return () => {
      const segMs =
        segmentStartRef.current !== null
          ? Date.now() - segmentStartRef.current
          : 0;
      const cap = maxMsPerSegment ?? Infinity;
      const newAccumulated = Math.min(
        accumulatedMsRef.current + segMs,
        cap
      );

      // Per-item: persist for next visit.
      writeStored(newAccumulated);

      // Daily rollups: only the delta from THIS session (the stored
      // amount was already counted when it was first accumulated).
      const sessionDelta = newAccumulated - storedAccumulated;
      setActiveSession(null);
      if (sessionDelta >= 1000) {
        accumulateMinutes(type, sessionDelta / 60000);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, segmentKey]);

  // Handle active state changes (user pause / resume).
  useEffect(() => {
    const wasActive = activeRef.current;
    if (wasActive === active) return;
    activeRef.current = active;

    if (active && !wasActive) {
      // Resume: start a new segment from now. The cap is reset too
      // (a manual resume after a cap-reach should give the user a
      // fresh budget — otherwise they'd get capped again in <1s).
      segmentStartRef.current = Date.now();
      setRunning(true);
    } else if (!active && wasActive) {
      // Pause: accumulate the in-progress segment into the buffer.
      if (segmentStartRef.current !== null) {
        accumulatedMsRef.current += Date.now() - segmentStartRef.current;
        segmentStartRef.current = null;
      }
      setRunning(false);
    }
  }, [active]);

  // Tick interval. Gated on BOTH `active` and `running` so the cap
  // can short-circuit the interval without re-running the active
  // effect. The interval self-clears when running flips to false.
  useEffect(() => {
    if (!active || !running) return;
    const interval = window.setInterval(() => {
      const segMs =
        segmentStartRef.current !== null
          ? Date.now() - segmentStartRef.current
          : 0;
      const currentTotal = accumulatedMsRef.current + segMs;
      const cap = maxMsPerSegment ?? Infinity;

      // Cap check: if (stored + this segment's elapsed) >= cap, freeze
      // at the cap and flip running=false. Both stored and the current
      // segment contribute to the total — this matches the docx's
      // "封顶累加" model where each item can contribute up to its cap.
      if (maxMsPerSegment !== undefined && currentTotal >= cap) {
        accumulatedMsRef.current = cap;
        segmentStartRef.current = null;
        writeStored(cap);
        setElapsed(cap);
        setRunning(false);
        return;
      }

      setElapsed(currentTotal);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [active, running, maxMsPerSegment, segmentKey]);

  return { elapsed, running };
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
