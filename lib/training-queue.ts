// LocalStorage-backed retry queue for fire-and-forget Supabase writes.
//
// The bug: useSessionTimer.accumulateMinutes() in lib/today-stats.ts
// fires recordDailyActivity() (a server action) without awaiting it.
// If the user closes the tab, switches networks, or the request drops
// the minute, daily_rollups on Supabase never gets the delta — but
// localStorage already does. The dashboard streak / week counters
// (which read from daily_rollups via use-daily-rollups.ts) then show 0
// even though the user clearly trained.
//
// The fix: enqueue exactly one (date, type, minutes) item per write.
// flushSync() drains the queue and tries each item; on success it's
// removed, on failure it stays for the next flush attempt.
//
// Stored in localStorage under "japaneseLearning.syncQueue" as JSON.

import type { TrainingItemId } from "@/lib/today-stats";

export type SyncQueueItem = {
  date: string; // YYYY-MM-DD
  type: TrainingItemId;
  minutes: number;
  enqueuedAt: number;
};

const QUEUE_KEY = "japaneseLearning.syncQueue";

function safeWindow(): Window | undefined {
  return typeof window === "undefined" ? undefined : window;
}

export function enqueueSync(item: SyncQueueItem): void {
  const w = safeWindow();
  if (!w) return;
  try {
    const raw = w.localStorage.getItem(QUEUE_KEY);
    const arr: SyncQueueItem[] = raw ? JSON.parse(raw) : [];
    arr.push(item);
    w.localStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
  } catch {
    // storage quota / private mode — silently drop. Better than throwing.
  }
}

export function readQueue(): SyncQueueItem[] {
  const w = safeWindow();
  if (!w) return [];
  try {
    const raw = w.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as SyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

// Destructive: returns the queue and clears it. Caller is responsible for
// re-queueing any items it failed to process.
export function drainQueue(): SyncQueueItem[] {
  const w = safeWindow();
  if (!w) return [];
  const items = readQueue();
  try {
    w.localStorage.removeItem(QUEUE_KEY);
  } catch {
    // ignore
  }
  return items;
}

export function requeueItems(items: SyncQueueItem[]): void {
  const w = safeWindow();
  if (!w || items.length === 0) return;
  const existing = readQueue();
  try {
    w.localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([...existing, ...items])
    );
  } catch {
    // ignore
  }
}

// Debug helper used by the migration shim.
export function queueLength(): number {
  return readQueue().length;
}

// Drain + flush. For each queued (date, type, minutes) item call the
// recordDailyActivity server action; on success the item is already
// removed by drainQueue(); on failure the rest of the batch
// (including the failed one) goes back into the queue for next time.
//
// Safe under retries because each item represents an exact delta
// (the additive daily_rollups.upsert_daily_rollup RPC dedupes by
// primary key). The dynamic import keeps the server-action
// boundary clean — calling it from a plain client module makes
// Next.js replace the import with a fetch round-trip at runtime.
export async function flushSync(): Promise<void> {
  const items = drainQueue();
  if (items.length === 0) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const { recordDailyActivity } = await import(
        "@/app/actions/record-activity"
      );
      await recordDailyActivity(item.date, item.minutes, 0);
    } catch (err) {
      // Re-queue this and everything after it for the next attempt.
      requeueItems(items.slice(i));
      console.error("sync flush failed (will retry on next trigger):", err);
      return;
    }
  }
}

// --- Migration shim (Per Frank #6314 + #6325) -----------------------------
//
// Problem: today's minutes existed in localStorage on the device that
// trained (e.g. Android saw 74 min, desktop saw 19 min) but the
// fire-and-forget recordDailyActivity call dropped before reaching
// Supabase. /today's accumulated[] reads from localStorage, so the
// per-section time on /today still looked right — but the dashboard
// streak / week stats (which read from Supabase via use-daily-rollups)
// showed 0. The retry queue in this file only catches FUTURE writes.
//
// Fix: when the dashboard mounts, check today's localStorage total
// against Supabase's daily_rollups.minutes. If localStorage has
// more, push the delta via recordDailyActivity (additive). The shim
// is idempotent: future runs see localStorage=Supabase, delta=0,
// no-op. We intentionally do NOT clear localStorage — /today still
// reads from it (and the values are now an exact mirror of Supabase).
//
// Multiple devices shimming simultaneously can each push their own
// delta; the additive RPC means the total converges to the sum of
// each device's local view, which is the true cross-device total.

const ACCUMULATED_KEY_PREFIX = "japaneseLearning.accumulated.";

function getLocalAccumulatedTotal(date: string): number {
  const w = safeWindow();
  if (!w) return 0;
  try {
    const raw = w.localStorage.getItem(ACCUMULATED_KEY_PREFIX + date);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as {
      accumulated: Record<string, number>;
    };
    return Object.values(parsed.accumulated ?? {}).reduce(
      (s, m) => s + (Number(m) || 0),
      0
    );
  } catch {
    return 0;
  }
}

// Compute YYYY-MM-DD locally — todayKey() in lib/today-stats isn't
// exported, and we don't want to pull in the whole hook module just
// for this one helper.
function resolveTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function shimTodayGap(): Promise<void> {
  const w = safeWindow();
  if (!w) return;

  const today = resolveTodayKey();
  const localTotal = getLocalAccumulatedTotal(today);
  if (localTotal <= 0) return;

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: rollup } = await supabase
      .from("daily_rollups")
      .select("minutes")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const supabaseMinutes = Number(rollup?.minutes ?? 0);

    if (localTotal > supabaseMinutes) {
      const delta = localTotal - supabaseMinutes;
      const { recordDailyActivity } = await import(
        "@/app/actions/record-activity"
      );
      await recordDailyActivity(today, delta, 0);
    }
    // No localStorage clear — the shim is idempotent (next run sees
    // localStorage=Supabase, delta=0). Leaving the data lets /today
    // continue to read per-section minutes from localStorage as before.
  } catch (err) {
    console.error("shim today gap failed (will retry on next mount):", err);
  }
}
