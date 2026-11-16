"use client";

/**
 * The TTS speed the user has chosen, shared by every speak button.
 *
 * Audit 2026-11-16 P1-14: "朗读加语速档（0.5/0.75/1.0/1.2）". The rate
 * used to be hardcoded to 0.9 in two different components, so a learner
 * who wanted a slower read (a beginner, or someone practising a
 * difficult word) had no way to get one.
 *
 * A tiny module-level store rather than React context: the speed has
 * to survive navigation between the list and the detail page, and a
 * provider would have to wrap every route. The chosen rate is kept in
 * localStorage so it is still there tomorrow.
 */

import { useEffect, useState } from "react";

export const SPEAK_RATES = [0.5, 0.75, 1.0, 1.2] as const;

export type SpeakRate = (typeof SPEAK_RATES)[number];

const STORAGE_KEY = "jp_speak_rate";
const EVENT = "jp:speak-rate";

/** The rate to use right now. Safe on the server (returns the default). */
export function getSpeakRate(): number {
  if (typeof window === "undefined") return 1.0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 1.0;
    const n = Number(raw);
    return (SPEAK_RATES as readonly number[]).includes(n) ? n : 1.0;
  } catch {
    return 1.0;
  }
}

export function setSpeakRate(rate: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(rate));
  } catch {
    // private mode — the rate still applies for this page view.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: rate }));
}

/** Subscribe to the chosen rate. */
export function useSpeakRate(): number {
  const [rate, setRate] = useState(0.5 * 0 + 1.0);

  useEffect(() => {
    setRate(getSpeakRate());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as number;
      if (typeof detail === "number") setRate(detail);
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return rate;
}

/**
 * The speed picker. Rendered next to the speak button so the choice is
 * visible where it matters.
 */
export function SpeakSpeedPicker({
  className = "",
}: {
  className?: string;
}) {
  const rate = useSpeakRate();

  return (
    <label
      className={`inline-flex items-center gap-1 text-xs text-gray-500 ${className}`}
      title="朗读速度"
    >
      <span className="sr-only">朗读速度</span>
      <select
        value={rate}
        onChange={(e) => setSpeakRate(Number(e.target.value))}
        aria-label="朗读速度"
        className="px-1.5 py-0.5 border border-gray-300 rounded bg-white text-xs text-gray-600"
      >
        {SPEAK_RATES.map((r) => (
          <option key={r} value={r}>
            {r.toFixed(2).replace(/0$/, "")}×
          </option>
        ))}
      </select>
    </label>
  );
}
