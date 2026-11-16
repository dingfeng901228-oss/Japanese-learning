// The spaced-repetition schedule — the single definition of the four
// grades, shared by the review UI, the server action and the /progress
// explanation.
//
// Audit 2026-11-16 P1-6. Before this the review flow had two buttons
// (再来一次 / 记住了) and the mastery step was a flat +10 / -10, so
// there was no gradation between "completely blank" and "got it".
//
// The schedule is SM-2 with a four-grade scale:
//
//   grade   quality   mastery step   interval
//   ------  --------  -------------  ------------------------------------
//   忘了     1        -10            1 day (back to the start)
//   模糊     3        +5             2 days
//   记得     4        +15            1 -> 6 -> interval x ease
//   熟练     5        +25            1 -> 2 -> interval x ease x 1.3
//
// Mastery is clamped to [0, 100]. It is a display metric, not the
// schedule driver — next_review_at is.

export type GradeId = "again" | "hard" | "good" | "easy";

export type Grade = {
  id: GradeId;
  /** the button label */
  label: string;
  /** a short hint under the label */
  hint: string;
  /** SM-2 quality (1-5) */
  quality: number;
  /** mastery points added (negative = a loss) */
  masteryDelta: number;
  /** tailwind classes for the button */
  buttonClass: string;
};

export const GRADES: Grade[] = [
  {
    id: "again",
    label: "忘了",
    hint: "完全想不起来",
    quality: 1,
    masteryDelta: -10,
    buttonClass:
      "flex-1 px-3 py-4 rounded-xl border-2 border-red-300 text-red-700 hover:bg-red-50 active:bg-red-100 active:translate-y-px transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  },
  {
    id: "hard",
    label: "模糊",
    hint: "想了很久才想起",
    quality: 3,
    masteryDelta: 5,
    buttonClass:
      "flex-1 px-3 py-4 rounded-xl border-2 border-amber-300 text-amber-700 hover:bg-amber-50 active:bg-amber-100 active:translate-y-px transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  },
  {
    id: "good",
    label: "记得",
    hint: "正常想起",
    quality: 4,
    masteryDelta: 15,
    buttonClass:
      "flex-1 px-3 py-4 rounded-xl border-2 border-green-300 text-green-700 hover:bg-green-50 active:bg-green-100 active:translate-y-px transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  },
  {
    id: "easy",
    label: "熟练",
    hint: "脱口而出",
    quality: 5,
    masteryDelta: 25,
    buttonClass:
      "flex-1 px-3 py-4 rounded-xl border-2 border-blue-300 text-blue-700 hover:bg-blue-50 active:bg-blue-100 active:translate-y-px transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  },
];

export function gradeById(id: string): Grade | undefined {
  return GRADES.find((g) => g.id === id);
}

export const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ScheduleState = {
  /** current mastery, 0-100 */
  mastery: number;
  /** current interval in days */
  intervalDays: number;
  /** current SM-2 ease factor */
  ease: number;
};

export type ScheduleResult = {
  mastery: number;
  intervalDays: number;
  ease: number;
  /** when the word comes back */
  nextReviewAt: Date;
};

/**
 * Apply a grade to the current schedule and return the new one.
 *
 * The ease update is the standard SM-2 formula:
 *   ease += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
 */
export function scheduleReview(
  state: ScheduleState,
  gradeId: GradeId,
  now: Date = new Date()
): ScheduleResult {
  const grade = gradeById(gradeId) ?? gradeById("good")!;
  const { quality } = grade;

  let interval: number;
  let ease = Number(state.ease) || 2.5;

  if (quality < 3) {
    // 忘了 — back to the start, ease drops.
    interval = 1;
    ease = Math.max(MIN_EASE, ease - 0.2);
  } else if (gradeId === "hard") {
    // 模糊 — a short interval, ease barely moves.
    interval = 2;
    ease = Math.max(MIN_EASE, ease - 0.05);
  } else if (quality >= 5) {
    // 熟练 — grow faster than plain SM-2.
    if (state.intervalDays <= 0) interval = 2;
    else if (state.intervalDays === 1) interval = 3;
    else interval = Math.max(2, Math.round(state.intervalDays * ease * 1.3));
    ease = Math.min(2.8, ease + 0.1);
  } else {
    // 记得 — plain SM-2 growth.
    if (state.intervalDays <= 0) interval = 1;
    else if (state.intervalDays === 1) interval = 6;
    else interval = Math.max(1, Math.round(state.intervalDays * ease));
    ease = Math.max(MIN_EASE, ease + 0.1);
  }

  const mastery = Math.max(
    0,
    Math.min(100, state.mastery + grade.masteryDelta)
  );
  const nextReviewAt = new Date(now.getTime() + interval * DAY_MS);

  return { mastery, intervalDays: interval, ease, nextReviewAt };
}

/** "2026-11-20" style date for the UI. */
export function formatNextReview(date: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
