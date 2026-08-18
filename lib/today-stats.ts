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

import { useEffect, useState } from "react";

export type TrainingItemId = "listening" | "speaking" | "shadowing" | "review";

export type TrainingItemDef = {
  id: TrainingItemId;
  label: string;
  emoji: string;
  minutes: number;
  href: string;
};

// Order matters — this is the order the user sees on /today.
export const TRAINING_ITEMS: TrainingItemDef[] = [
  { id: "listening", label: "听力", emoji: "🎧", minutes: 10, href: "/listening" },
  { id: "speaking", label: "口语", emoji: "🎤", minutes: 10, href: "/speaking" },
  { id: "shadowing", label: "Shadowing", emoji: "🔁", minutes: 5, href: "/listening?mode=shadow" },
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

// React hook for tracking session time on a training page. Returns:
//   - elapsed: ms since the timer started (updates every second)
//   - running: true while the timer is active
//
// On unmount or pagehide (covers tab close + mobile app switch),
// accumulates elapsed minutes into DayAccumulated under `type`.
// Sub-second sessions are ignored to avoid noise from rapid back
// clicks.
export function useSessionTimer(type: TrainingItemId): {
  elapsed: number;
  running: boolean;
} {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    setActiveSession({ type, startedAt });
    setRunning(true);
    setElapsed(0);

    const interval = window.setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1000);

    const saveElapsed = () => {
      window.clearInterval(interval);
      const elapsedMs = Date.now() - startedAt;
      setActiveSession(null);
      setRunning(false);
      if (elapsedMs >= 1000) {
        accumulateMinutes(type, elapsedMs / 60000);
      }
    };

    window.addEventListener("pagehide", saveElapsed);
    return () => {
      window.removeEventListener("pagehide", saveElapsed);
      saveElapsed();
    };
  }, [type]);

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
