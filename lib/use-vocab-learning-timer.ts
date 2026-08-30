"use client";

// useVocabLearningTimer — per-vocab 5s cumulative learning time tracker
// per docs/0830需求.md (Frank #7274 / #7276, 2026-08-30).
//
// State machine:
//   IDLE      → initial, before baseline fetch resolves
//   VIEWING   → user actively looking at the vocab, ticking
//   PAUSED    → page backgrounded or tab hidden
//   COMPLETED → today's 5000ms cap reached, freezes at 5.0s/5.0s
//
// Timing model (per §六):
//   - Uses Date.now() for real elapsed time, NOT setInterval counting.
//     The setInterval is only for re-rendering the display every 250ms.
//   - flushNow() captures (Date.now() - segmentStart) and sends it as a
//     delta to the server; the server adds + caps at 5000ms atomically
//     inside the increment_vocab_learning_time RPC (migration 0006).
//
// Triggers that flush (per §十二):
//   1. Unmount (vocab switch via SPA nav)
//   2. visibilitychange → hidden (transition VIEWING → PAUSED)
//   3. pagehide / beforeunload (sendBeacon, best-effort)
//   4. 5s cap reached (final flush, then COMPLETED)
//
// Daily reset (per Frank #7276 C):
//   - todayDate is computed client-side (local time) so JST users get
//     midnight-rollover that matches their perception of "today".
//   - The server stores the client-supplied date on the row, so reads
//     compare stored_date == client's todayKey() to decide whether
//     to treat the counter as 0.
//
// Concurrency / race-safety (per §十一):
//   - flushInFlightRef blocks concurrent flushes; segmentStartRef=null
//     marks "segment consumed" so the next flush call returns early.
//   - Server-side FOR UPDATE row lock inside the RPC serializes parallel
//     flushes from multiple tabs of the same /vocabulary/[id] URL.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getVocabLearningStateAction,
  recordVocabLearningTimeAction,
} from "@/app/vocabulary/actions";
import { accumulateMinutes } from "@/lib/today-stats";

export type LearningTimerState = "IDLE" | "VIEWING" | "PAUSED" | "COMPLETED";

export const MAX_LEARNING_MS = 5000;
const TICK_INTERVAL_MS = 250;
const MIN_FLUSH_DELTA_MS = 200; // debounce — ignore tiny segments
const MIN_DASHBOARD_DELTA_MS = 1000; // only feed "vocab" daily_rollups bucket if >= 1s

function todayKey(): string {
  // YYYY-MM-DD in local time — matches lib/today-stats.todayKey() so
  // daily_rollups "vocab" bucket and learning_time_ms daily reset align
  // to the same calendar day for the user.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useVocabLearningTimer(vocabId: string) {
  const [baselineMs, setBaselineMs] = useState(0);
  const [state, setState] = useState<LearningTimerState>("IDLE");
  const [displayMs, setDisplayMs] = useState(0);

  // Refs read by stable handlers (visibility, pagehide) without re-binding.
  const segmentStartRef = useRef<number | null>(null);
  const stateRef = useRef<LearningTimerState>("IDLE");
  const baselineRef = useRef(0);
  const flushInFlightRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    baselineRef.current = baselineMs;
  }, [baselineMs]);

  const flushNow = useCallback(
    async (final: boolean = false): Promise<void> => {
      if (flushInFlightRef.current) return;
      const segStart = segmentStartRef.current;
      if (segStart === null) return;
      const delta = Date.now() - segStart;
      if (delta < MIN_FLUSH_DELTA_MS && !final) return;

      flushInFlightRef.current = true;
      // Mark segment consumed BEFORE await so a re-entrant flush call
      // returns early. On error we restore segmentStartRef to retry.
      segmentStartRef.current = null;

      try {
        const result = await recordVocabLearningTimeAction(
          vocabId,
          delta,
          todayKey()
        );
        setBaselineMs(result.learningTimeMs);
        setDisplayMs(result.learningTimeMs);
        baselineRef.current = result.learningTimeMs;

        // Also contribute to dashboard "vocab" bucket — preserves the
        // /vocabulary + /review time aggregation that Frank #6671 set up.
        // Skip sub-second segments — usually navigation noise.
        if (delta >= MIN_DASHBOARD_DELTA_MS) {
          try {
            accumulateMinutes("vocab", delta / 60000);
          } catch {
            // accumulateMinutes is best-effort; non-fatal.
          }
        }

        if (result.learningTimeMs >= MAX_LEARNING_MS) {
          setState("COMPLETED");
          // segmentStartRef stays null — no more accumulation today.
        } else if (stateRef.current === "VIEWING") {
          // Continue counting from now (caller was VIEWING and is mid-segment).
          segmentStartRef.current = Date.now();
        }
        // If state is PAUSED / COMPLETED, leave segmentStartRef null —
        // the PAUSED caller will start a new segment when visibility
        // flips back to visible.
      } catch (err) {
        // Restore the segment so the next flush retries the same window.
        // Delta will be slightly larger (includes the time we waited on
        // the failed RPC) — server-side cap still holds.
        segmentStartRef.current = Date.now() - delta;
        console.error("useVocabLearningTimer: flush failed", {
          vocabId,
          delta,
          err,
        });
      } finally {
        flushInFlightRef.current = false;
      }
    },
    [vocabId]
  );

  // Mount / vocabId change: fetch baseline, start segment if visible.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getVocabLearningStateAction(vocabId, todayKey());
        if (cancelled) return;
        setBaselineMs(result.learningTimeMs);
        baselineRef.current = result.learningTimeMs;
        setDisplayMs(result.learningTimeMs);

        if (result.learningTimeMs >= MAX_LEARNING_MS) {
          setState("COMPLETED");
          // No segment — frozen at 5.0s for the rest of today.
        } else if (
          typeof document !== "undefined" &&
          document.visibilityState === "visible"
        ) {
          segmentStartRef.current = Date.now();
          setState("VIEWING");
        } else {
          setState("PAUSED");
          // No segment until visibility flips to visible.
        }
      } catch (err) {
        if (cancelled) return;
        console.error("useVocabLearningTimer: init failed", { vocabId, err });
        // Start fresh on error — don't strand the user on a broken timer.
        segmentStartRef.current = Date.now();
        setState("VIEWING");
      }
    })();
    return () => {
      cancelled = true;
      // Final flush on unmount (vocab switch / SPA nav away).
      // pagehide handler covers tab close + refresh separately.
      flushNow(true);
    };
    // flushNow is intentionally excluded — its identity changes when
    // vocabId changes (it's captured in this effect's closure), and
    // including it would re-run the mount logic on every flush.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabId]);

  // Tick: update display + check cap. Gated on VIEWING — the cap-reach
  // path calls flushNow(true) which transitions to COMPLETED, after
  // which the interval is re-bound to no-op (state !== VIEWING).
  useEffect(() => {
    if (state !== "VIEWING") return;
    const id = window.setInterval(() => {
      const segStart = segmentStartRef.current;
      if (segStart === null) return;
      const elapsed = baselineRef.current + (Date.now() - segStart);
      const clamped = Math.min(elapsed, MAX_LEARNING_MS);
      setDisplayMs(clamped);
      if (elapsed >= MAX_LEARNING_MS) {
        flushNow(true).then(() => {
          setState("COMPLETED");
        });
      }
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [state, flushNow]);

  // Visibility change: pause (hidden) / resume (visible).
  useEffect(() => {
    function handle() {
      if (document.visibilityState === "hidden") {
        if (stateRef.current === "VIEWING") {
          setState("PAUSED");
          flushNow(false);
        }
      } else if (document.visibilityState === "visible") {
        if (stateRef.current === "PAUSED") {
          segmentStartRef.current = Date.now();
          setState("VIEWING");
        }
      }
    }
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [flushNow]);

  // pagehide / beforeunload: best-effort sendBeacon so a tab close
  // doesn't lose the in-progress segment (per docs/0830需求.md §四).
  useEffect(() => {
    function handle() {
      const segStart = segmentStartRef.current;
      if (segStart === null) return;
      const delta = Date.now() - segStart;
      if (delta < MIN_FLUSH_DELTA_MS) return;
      // Mark consumed so we don't double-write via the unmount flush.
      segmentStartRef.current = null;
      try {
        const body = JSON.stringify({
          vocabId,
          deltaMs: delta,
          date: todayKey(),
        });
        const blob = new Blob([body], { type: "application/json" });
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.sendBeacon === "function"
        ) {
          navigator.sendBeacon("/api/vocabulary/learning-time", blob);
        }
      } catch (err) {
        console.error("useVocabLearningTimer: sendBeacon failed", err);
      }
    }
    window.addEventListener("pagehide", handle);
    window.addEventListener("beforeunload", handle);
    return () => {
      window.removeEventListener("pagehide", handle);
      window.removeEventListener("beforeunload", handle);
    };
  }, [vocabId]);

  return {
    state,
    displayMs,
    remainingMs: Math.max(0, MAX_LEARNING_MS - displayMs),
    progress: Math.min(1, displayMs / MAX_LEARNING_MS),
    isCompleted: state === "COMPLETED",
    isViewing: state === "VIEWING",
    isPaused: state === "PAUSED",
  };
}
