// P1.C — MistakeStorage abstraction (Phase 1 增强 #3, foundation).
// docs/phase1-enhancement-scope.md § P1.C.
//
// Cross-session mistake tracking with structured pattern types + a
// lightweight SRS hint. UI code calls one API; the storage layer picks
// Supabase when authenticated, localStorage when anonymous, and migrates
// the localStorage history to Supabase on first auth (idempotent).
//
// UI integration (speaking/page.tsx writes; today/page.tsx reads) is
// deferred to PR #3. This module is the foundation only: it ships
// alongside 0003_mistake_history.sql so wiring is one diff later.
//
// Design notes:
//  - `Mistake` re-uses P1.B's IssueType (7 type enum) + Severity (3-level).
//    Mistake type was kept narrow (no tokenIndex/expected/heard) because
//    storage is aggregate (one Mistake per error, not per-token).
//  - detectedAt is epoch ms (consistent between client + server; Supabase
//    conversion happens at the storage boundary).
//  - reviewQueue priority = reviewCount * exp(-daysSince / 14). 14-day
//    decay keeps recent mistakes prominent; reviewCount amplifies
//    frequency. Sorted desc, top N returned.
//  - LocalStorageMistakeStorage preserves the legacy
//    `japaneseLearning.mistakeHistory` shape (grammar[] / vocabulary[])
//    for backward compat — it adds an OPTIONAL `mistakes?: Mistake[]`
//    field. Legacy entries (no mistakes[]) are kept around for the
//    existing UI in app/today/page.tsx until users re-grade.
//
// Marked "use client" because the storage layer reads localStorage and
// uses the browser Supabase client. Server-side callers should construct
// the Supabase storage directly with a server client.

"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { IssueType, Severity } from "@/lib/grade-types";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type Mistake = {
  /** UUID when sourced from DB; locally generated UUID for offline-first writes. */
  id?: string;
  sentenceId: string;
  sentenceTarget: string;
  transcript?: string;
  patternType: IssueType;
  severity: Severity;
  hint?: string;
  /** Epoch ms. Consistent across client + server. */
  detectedAt: number;
  reviewCount: number;
  nextReviewAt?: number;
};

export type MistakeInput = Omit<
  Mistake,
  "id" | "detectedAt" | "reviewCount" | "nextReviewAt"
>;

/**
 * Legacy `japaneseLearning.mistakeHistory` entry shape — grammar[] /
 * vocabulary[] are free-text and were written by the Phase 4 partial
 * implementation in app/speaking/page.tsx. P1.C adds `mistakes?` for the
 * structured form. Entries without `mistakes` are still readable by
 * app/today/page.tsx (it reads grammar[]/vocabulary[] directly).
 */
export type LegacyHistoryEntry = {
  id: string;
  timestamp: number;
  language: "zh" | "en";
  grammar: string[];
  vocabulary: string[];
  mistakes?: Mistake[];
};

export interface MistakeStorage {
  record(m: MistakeInput): Promise<Mistake>;
  recent(limit?: number): Promise<Mistake[]>;
  aggregateByPattern(): Promise<Record<IssueType, number>>;
  reviewQueue(limit?: number): Promise<Mistake[]>;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const TABLE = "mistake_history";

/** Best-effort UUID v4 generator. Falls back to a timestamp+random string
 *  for environments where crypto.randomUUID is unavailable (very old
 *  browsers). The fallback is unique enough for localStorage dedupe. */
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Convert a DB row (snake_case) to the Mistake shape (camelCase). */
function rowToMistake(row: Record<string, unknown>): Mistake {
  const detectedAtRaw = row.detected_at;
  const nextReviewAtRaw = row.next_review_at;
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    sentenceId: typeof row.sentence_id === "string" ? row.sentence_id : "",
    sentenceTarget:
      typeof row.sentence_target === "string" ? row.sentence_target : "",
    transcript:
      typeof row.transcript === "string" ? row.transcript : undefined,
    patternType: (typeof row.pattern_type === "string"
      ? row.pattern_type
      : "missing-word") as IssueType,
    severity: (typeof row.severity === "string"
      ? row.severity
      : "minor") as Severity,
    hint: typeof row.hint === "string" ? row.hint : undefined,
    detectedAt:
      detectedAtRaw instanceof Date
        ? detectedAtRaw.getTime()
        : new Date(String(detectedAtRaw ?? Date.now())).getTime(),
    reviewCount: typeof row.review_count === "number" ? row.review_count : 0,
    nextReviewAt:
      nextReviewAtRaw == null
        ? undefined
        : nextReviewAtRaw instanceof Date
        ? nextReviewAtRaw.getTime()
        : new Date(String(nextReviewAtRaw)).getTime(),
  };
}

/** Convert a Mistake to a DB row (snake_case). Skips undefined fields. */
function mistakeToRow(
  m: Mistake,
  userId: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    user_id: userId,
    sentence_id: m.sentenceId,
    sentence_target: m.sentenceTarget,
    pattern_type: m.patternType,
    severity: m.severity,
    detected_at: new Date(m.detectedAt).toISOString(),
    review_count: m.reviewCount,
  };
  if (m.id) row.id = m.id;
  if (m.transcript !== undefined) row.transcript = m.transcript;
  if (m.hint !== undefined) row.hint = m.hint;
  if (m.nextReviewAt !== undefined) {
    row.next_review_at = new Date(m.nextReviewAt).toISOString();
  }
  return row;
}

/** Compute SRS priority: higher = more urgent to revisit. */
function priorityOf(m: Mistake, now: number): number {
  const daysSince = Math.max(0, (now - m.detectedAt) / (1000 * 60 * 60 * 24));
  return m.reviewCount * Math.exp(-daysSince / 14);
}

// --------------------------------------------------------------------------
// Supabase storage
// --------------------------------------------------------------------------

/**
 * Supabase-backed implementation. Requires an authenticated user — the
 * RLS policy on mistake_history rejects writes from anon contexts. The
 * factory in `createMistakeStorage` picks this when `isAuthenticated` is
 * true; in server-side flows, callers can construct with a server client
 * directly.
 */
export class SupabaseMistakeStorage implements MistakeStorage {
  constructor(private readonly client: SupabaseClient) {}

  async record(m: MistakeInput): Promise<Mistake> {
    const {
      data: { user },
      error: authErr,
    } = await this.client.auth.getUser();
    if (authErr || !user) {
      throw new Error(
        `SupabaseMistakeStorage.record: not authenticated (${authErr?.message ?? "no user"})`,
      );
    }

    const detectedAt = Date.now();
    const reviewCount = 0;
    const id = generateId();
    const draft: Mistake = {
      ...m,
      id,
      detectedAt,
      reviewCount,
    };

    const { data, error } = await this.client
      .from(TABLE)
      .insert(mistakeToRow(draft, user.id))
      .select()
      .single();

    if (error || !data) {
      throw new Error(
        `SupabaseMistakeStorage.record: insert failed (${error?.message ?? "no data"})`,
      );
    }

    return rowToMistake(data as Record<string, unknown>);
  }

  async recent(limit = 50): Promise<Mistake[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(
        `SupabaseMistakeStorage.recent: query failed (${error.message})`,
      );
    }
    return (data ?? []).map((row) => rowToMistake(row as Record<string, unknown>));
  }

  async aggregateByPattern(): Promise<Record<IssueType, number>> {
    // Client-side aggregation is fine at this scale (per-user, capped by
    // `recent(1000)`). If a user ever accumulates >1000 mistakes, swap in
    // a Postgres view + group by RPC.
    const all = await this.recent(1000);
    const counts = {} as Record<IssueType, number>;
    for (const m of all) {
      counts[m.patternType] = (counts[m.patternType] ?? 0) + 1;
    }
    return counts;
  }

  async reviewQueue(limit = 10): Promise<Mistake[]> {
    const all = await this.recent(500);
    const now = Date.now();
    return all
      .map((m) => ({ m, priority: priorityOf(m, now) }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit)
      .map((x) => x.m);
  }
}

// --------------------------------------------------------------------------
// LocalStorage storage
// --------------------------------------------------------------------------

const LOCAL_KEY = "japaneseLearning.mistakeHistory";
const MIGRATED_FLAG = "japaneseLearning.mistakeHistoryMigrated";

/**
 * localStorage-backed implementation. Wraps the existing
 * `japaneseLearning.mistakeHistory` shape — preserves grammar[] /
 * vocabulary[] for the legacy UI in app/today/page.tsx, and adds an
 * OPTIONAL `mistakes?: Mistake[]` field that PR #3 will populate.
 *
 * Falls back silently on SSR (returns empty results) so the factory can
 * be called from any context.
 */
export class LocalStorageMistakeStorage implements MistakeStorage {
  private isBrowser(): boolean {
    return (
      typeof window !== "undefined" && typeof window.localStorage !== "undefined"
    );
  }

  private readAll(): LegacyHistoryEntry[] {
    if (!this.isBrowser()) return [];
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as LegacyHistoryEntry[]) : [];
    } catch {
      return [];
    }
  }

  private writeAll(entries: LegacyHistoryEntry[]): void {
    if (!this.isBrowser()) return;
    try {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
    } catch {
      // Storage quota / private mode — silently drop. The UI can still
      // render via the in-memory history it has set this session.
    }
  }

  async record(m: MistakeInput): Promise<Mistake> {
    const now = Date.now();
    const newMistake: Mistake = {
      ...m,
      id: generateId(),
      detectedAt: now,
      reviewCount: 0,
    };

    const entries = this.readAll();
    if (entries.length === 0) {
      // First ever mistake — create the legacy-shaped entry so the
      // existing today/page.tsx UI keeps working (grammar/vocab arrays
      // empty for now; PR #3 may populate them from the same source).
      entries.push({
        id: newMistake.id ?? generateId(),
        timestamp: now,
        language: "zh",
        grammar: [],
        vocabulary: [],
        mistakes: [newMistake],
      });
    } else {
      const last = entries[entries.length - 1];
      if (!last.mistakes) last.mistakes = [];
      last.mistakes.push(newMistake);
    }
    this.writeAll(entries);

    return newMistake;
  }

  async recent(limit = 50): Promise<Mistake[]> {
    const entries = this.readAll();
    const all: Mistake[] = [];
    for (const e of entries) {
      if (e.mistakes && e.mistakes.length > 0) {
        all.push(...e.mistakes);
      }
    }
    all.sort((a, b) => b.detectedAt - a.detectedAt);
    return all.slice(0, limit);
  }

  async aggregateByPattern(): Promise<Record<IssueType, number>> {
    const all = await this.recent(1000);
    const counts = {} as Record<IssueType, number>;
    for (const m of all) {
      counts[m.patternType] = (counts[m.patternType] ?? 0) + 1;
    }
    return counts;
  }

  async reviewQueue(limit = 10): Promise<Mistake[]> {
    const all = await this.recent(500);
    const now = Date.now();
    return all
      .map((m) => ({ m, priority: priorityOf(m, now) }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit)
      .map((x) => x.m);
  }
}

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------

/**
 * Pick the storage backend based on auth state. Supabase when authed,
 * localStorage when anonymous. The factory uses the browser Supabase
 * client; for server-side flows, construct SupabaseMistakeStorage
 * directly with a server client.
 */
export function createMistakeStorage(
  isAuthenticated: boolean,
): MistakeStorage {
  if (isAuthenticated) {
    return new SupabaseMistakeStorage(createBrowserSupabaseClient());
  }
  return new LocalStorageMistakeStorage();
}

// --------------------------------------------------------------------------
// Migration: localStorage → Supabase (one-time, idempotent)
// --------------------------------------------------------------------------

/**
 * On first auth, push localStorage mistakes to Supabase. Idempotent:
 *  - Sets `japaneseLearning.mistakeHistoryMigrated = "true"` after run
 *  - Uses upsert(..., { onConflict: "id" }) so re-runs don't dup rows
 *
 * Returns the count of mistakes successfully migrated. Skips legacy
 * entries that don't have a `mistakes[]` field (they'll be re-graded
 * once PR #3 lands).
 */
export async function migrateLocalToSupabase(): Promise<{ migrated: number }> {
  if (typeof window === "undefined") return { migrated: 0 };

  if (window.localStorage.getItem(MIGRATED_FLAG) === "true") {
    return { migrated: 0 };
  }

  const client = createBrowserSupabaseClient();
  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser();
  if (authErr || !user) {
    return { migrated: 0 };
  }

  const raw = window.localStorage.getItem(LOCAL_KEY);
  if (!raw) {
    window.localStorage.setItem(MIGRATED_FLAG, "true");
    return { migrated: 0 };
  }

  let entries: LegacyHistoryEntry[];
  try {
    const parsed = JSON.parse(raw);
    entries = Array.isArray(parsed) ? (parsed as LegacyHistoryEntry[]) : [];
  } catch {
    window.localStorage.setItem(MIGRATED_FLAG, "true");
    return { migrated: 0 };
  }

  // Collect structured mistakes; skip legacy entries without `mistakes`.
  const mistakes: Mistake[] = [];
  for (const e of entries) {
    if (e.mistakes && e.mistakes.length > 0) {
      mistakes.push(...e.mistakes);
    }
  }

  // Dedupe by id (localStorage sometimes has duplicates from re-renders).
  const seen = new Set<string>();
  const unique = mistakes.filter((m) => {
    if (!m.id) return true;
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  let migrated = 0;
  for (const m of unique) {
    const row = mistakeToRow(m, user.id);
    const { error } = await client
      .from(TABLE)
      .upsert(row, { onConflict: "id" });
    if (!error) {
      migrated++;
    } else {
      // Surface the first failure for debugging, but keep going —
      // partial migrations are better than no migration.
      console.warn(
        `[mistake-storage] migrate upsert failed: ${error.message}`,
      );
    }
  }

  window.localStorage.setItem(MIGRATED_FLAG, "true");
  return { migrated };
}
