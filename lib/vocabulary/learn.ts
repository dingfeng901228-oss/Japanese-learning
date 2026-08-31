// Server-side helpers for the "formal learning session" feature.
// Per docs/vocabuly0831.md (Frank #7397, 2026-08-31):
//
//   - learningCount = number of times the user entered /vocabulary/learn
//     with a fresh session_token. Incremented by the start_learning_session
//     RPC; DECOUPLED from mastery / reviewCount / 5s/word/DAY timer.
//   - lastLearningVocabularyId + filterContext = resume state for
//     /vocabulary → /vocabulary/learn navigation (Q5-α: ignore current
//     filter when resuming, but display original filter context).
//   - dailyStatus = manual toggle via [完成今日学习] / [重新开始]. NOT
//     auto-coupled to learningCount / review / 5s (Q4-A).
//
// All queries rely on the Supabase session cookie (via lib/supabase/server.ts)
// and the RLS policies in supabase/migrations/0007_vocab_learning_count.sql
// — the user_id filter on `eq` is redundant with RLS but kept for clarity.

import { createClient } from "@/lib/supabase/server";

export type LearningFilterContext = {
  type: string | null;
  level: string | null;
  sort: string | null;
  query: string | null;
};

export type LearningStateVocab = {
  id: string;
  word: string;
  reading: string | null;
  meaning: string;
  type: string;
  level: string | null;
};

export type LearningState = {
  lastLearningVocabulary: LearningStateVocab | null;
  lastLearningAt: string | null;
  filterContext: LearningFilterContext | null;
  dailyStatus: "active" | "completed";
};

export type StartLearningSessionOpts = {
  vocabId: string;
  sessionToken: string;
  filterContext?: LearningFilterContext;
};

export type StartLearningSessionResult = {
  learningCount: number;
  isNewSession: boolean;
};

// Local-time "today" as YYYY-MM-DD string. Matches the pattern in
// lib/use-vocab-learning-timer.ts todayKey() and lib/today-stats.ts
// todayKey() so the server-side daily boundaries align with what the
// user sees as "today" in their browser (JST for Frank).
function todayLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const EMPTY_STATE: LearningState = {
  lastLearningVocabulary: null,
  lastLearningAt: null,
  filterContext: null,
  dailyStatus: "active",
};

// ==========================================================================
// getUserLearningState — fetch the user's resume state + daily status.
//
// Returns the FULL joined snapshot needed by the list-page "继续学习" card
// (vocab word / reading / meaning / type / level) so the server component
// can render the card without an extra vocab lookup round-trip.
//
// Edge cases handled here:
//   - No row in user_learning_state yet → EMPTY_STATE (first-time user).
//   - Row exists but vocab was deleted (LEFT JOIN gives NULL vocab
//     fields) → lastLearningVocabulary: null. The FK ON DELETE SET NULL
//     already cleared last_learning_vocabulary_id, so the LEFT JOIN
//     matching NULL is a defensive belt-and-suspenders.
//   - daily_status='completed' but daily_status_date != today's local
//     date → treat as 'active' (Frank #7397 Q4: "第二天：自动 active").
// ==========================================================================
export async function getUserLearningState(): Promise<LearningState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_STATE;

  const { data, error } = await supabase.rpc("get_user_learning_state", {
    p_user_id: user.id,
  });
  if (error) {
    console.error("getUserLearningState RPC failed:", error);
    return EMPTY_STATE;
  }
  if (!data || data.length === 0) return EMPTY_STATE;

  const row = data[0] as {
    last_learning_vocabulary_id: string | null;
    last_learning_word: string | null;
    last_learning_reading: string | null;
    last_learning_meaning: string | null;
    last_learning_type: string | null;
    last_learning_level: string | null;
    last_learning_at: string | null;
    filter_type: string | null;
    filter_level: string | null;
    filter_sort: string | null;
    filter_query: string | null;
    daily_status: string;
    daily_status_date: string | null;
  };

  // lastLearningVocabulary: present iff FK is set AND the vocab still
  // exists (LEFT JOIN returned non-null fields).
  const lastLearningVocabulary: LearningStateVocab | null =
    row.last_learning_vocabulary_id && row.last_learning_word
      ? {
          id: row.last_learning_vocabulary_id,
          word: row.last_learning_word,
          reading: row.last_learning_reading,
          meaning: row.last_learning_meaning ?? "",
          type: row.last_learning_type ?? "word",
          level: row.last_learning_level,
        }
      : null;

  // dailyStatus: only count as 'completed' if the stored date matches
  // today's client-local date. Otherwise (yesterday, NULL, etc) treat
  // as 'active' — Frank #7397 Q4 natural rollover.
  const dailyStatus: "active" | "completed" =
    row.daily_status === "completed" && row.daily_status_date === todayLocalISO()
      ? "completed"
      : "active";

  // filterContext: present iff at least one field is set.
  const filterContext: LearningFilterContext | null =
    row.filter_type ||
    row.filter_level ||
    row.filter_sort ||
    row.filter_query
      ? {
          type: row.filter_type,
          level: row.filter_level,
          sort: row.filter_sort,
          query: row.filter_query,
        }
      : null;

  return {
    lastLearningVocabulary,
    lastLearningAt: row.last_learning_at,
    filterContext,
    dailyStatus,
  };
}

// ==========================================================================
// startLearningSession — call the start_learning_session RPC.
//
// Idempotency: the RPC PKs (user_id, session_token) in
// vocab_learning_session_tokens, so a duplicate token for the same user
// is silently ignored. Counter only increments on a fresh token —
// tab refresh reuses the sessionStorage token (no +1), new tab/day
// gets a fresh token (+1).
//
// filterContext (the list-page filters at the time of click) is captured
// by the RPC and stored on user_learning_state so the next list-page
// "继续学习" card can show "(原 filter: 文法 N3)".
// ==========================================================================
export async function startLearningSession(
  opts: StartLearningSessionOpts,
): Promise<StartLearningSessionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase.rpc("start_learning_session", {
    p_vocab_id: opts.vocabId,
    p_user_id: user.id,
    p_session_token: opts.sessionToken,
    p_filter_type: opts.filterContext?.type ?? null,
    p_filter_level: opts.filterContext?.level ?? null,
    p_filter_sort: opts.filterContext?.sort ?? null,
    p_filter_query: opts.filterContext?.query ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("start_learning_session RPC returned no data");
  }

  const row = data[0] as {
    new_learning_count: number;
    is_new_session: boolean;
  };
  return {
    learningCount: row.new_learning_count,
    isNewSession: row.is_new_session,
  };
}

// ==========================================================================
// setDailyLearningStatus — toggle today's completion flag.
//
// status='completed' ← [完成今日学习] button click in /vocabulary/learn.
// status='active'    ← [重新开始] click (optional UX).
// p_date is client-local today — matches the daily boundary pattern
// used elsewhere in the project (0006 migration RPC accepts client
// p_date so a JST user's "today" feels right even though the server
// runs in UTC).
//
// DECOUPLING NOTE: this does NOT touch learningCount / mastery /
// reviewCount / 5s timer. Per Frank #7397 Q4: "不要让「完成今日学习」
// 影响：- learningCount - mastery - reviewCount - 5 秒计时".
// ==========================================================================
export async function setDailyLearningStatus(
  status: "active" | "completed",
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.rpc("set_daily_learning_status", {
    p_user_id: user.id,
    p_status: status,
    p_date: todayLocalISO(),
  });
  if (error) throw new Error(error.message);
}