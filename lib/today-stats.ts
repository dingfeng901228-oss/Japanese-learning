// Daily training-progress tracking (client-side, localStorage).
//
// Persists today's "completed training items" + accumulated minutes
// across page reloads. Date-keyed: the storage key includes YYYY-MM-DD
// so the state resets at midnight automatically (no manual reset
// needed). Also computes the countdown to end-of-day for the /today
// header.
//
// Per Frank #6171: "增加学习时间，计时的功能及完成打卡时间进度条"
//                  "增加当天结束的倒计时功能"
// — these two features (timer/check-in + countdown) are exactly what
// this module powers.

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
  // Recompute total from scratch to avoid drift if items are added/
  // removed between sessions.
  progress.totalMinutes = TRAINING_ITEMS.filter(
    (i) => progress.completed[i.id]
  ).reduce((s, i) => s + i.minutes, 0);
  saveDayProgress(progress);
  return progress;
}

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
