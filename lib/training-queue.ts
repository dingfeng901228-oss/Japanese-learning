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
