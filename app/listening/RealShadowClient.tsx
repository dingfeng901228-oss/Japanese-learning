"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import type { MottoSentence } from "@/lib/motto-sentences-types";
import { useSessionTimer, formatDuration } from "@/lib/today-stats";

const PROGRESS_KEY = "japanese:shadowing-motto-progress";
const SHADOW_HISTORY_KEY = "japanese:shadowing-motto-history";
const PLAYBACK_PREFS_KEY = "japanese:shadowing-motto-playback-prefs";
const LAST_IDX_KEY = "japanese:shadowing-motto-last-idx";
const PAGE_SIZE = 10;

type PlaybackPrefs = {
  loopCurrent: boolean;
  autoNext: boolean;
  playbackRate: number;
};

const VALID_RATES: readonly number[] = [1.0, 1.1, 1.2];

type ShadowGrade = {
  accuracy: number;
  fluency: number;
  feedback: string;
  suggestions: string[];
  encouragement: string;
};

type ShadowHistoryEntry = {
  id: string;
  mottoId: string;
  timestamp: number;
  transcript: string;
  grade: ShadowGrade;
};

type Phase = "idle" | "recording" | "transcribing" | "grading" | "result";

function loadProgress(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}
function saveProgress(s: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(s)));
}
function loadShadowHistory(): ShadowHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHADOW_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ShadowHistoryEntry[]) : [];
  } catch {
    return [];
  }
}
function saveShadowHistory(h: ShadowHistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SHADOW_HISTORY_KEY,
    JSON.stringify(h.slice(0, 50))
  );
}
function loadPlaybackPrefs(): PlaybackPrefs {
  if (typeof window === "undefined") {
    return { loopCurrent: false, autoNext: false, playbackRate: 1.0 };
  }
  try {
    const raw = window.localStorage.getItem(PLAYBACK_PREFS_KEY);
    if (!raw) return { loopCurrent: false, autoNext: false, playbackRate: 1.0 };
    const parsed = JSON.parse(raw);
    const rate =
      typeof parsed.playbackRate === "number" &&
      VALID_RATES.includes(parsed.playbackRate)
        ? parsed.playbackRate
        : 1.0;
    return {
      loopCurrent: !!parsed.loopCurrent,
      autoNext: !!parsed.autoNext,
      playbackRate: rate,
    };
  } catch {
    return { loopCurrent: false, autoNext: false, playbackRate: 1.0 };
  }
}
function savePlaybackPrefs(p: PlaybackPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYBACK_PREFS_KEY, JSON.stringify(p));
}
function loadLastIdx(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(LAST_IDX_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  } catch {
    return 0;
  }
}
function saveLastIdx(idx: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_IDX_KEY, String(idx));
}
function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatAudioTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Split Japanese HTML into per-sentence strings, preserving <ruby> furigana.
 * Strategy: normalize <br> and \n to 。, then split on 。, filter empty,
 * and re-add 。 to non-final segments that don't already end in sentence-final
 * punctuation. Last segment is kept verbatim (may end with ? / ! / nothing).
 */
function splitHtmlSentences(html: string): string[] {
  const normalized = html.replace(/<br\s*\/?>/gi, "。").replace(/\n/g, "。");
  const parts = normalized.split("。");
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i].trim();
    if (!seg) continue;
    const stripped = seg.replace(/<[^>]*>/g, "").trim();
    const endsWithPunct = /[。？！!?]$/.test(stripped);
    const isLast = i === parts.length - 1;
    if (isLast || endsWithPunct) {
      result.push(seg);
    } else {
      result.push(seg + "。");
    }
  }
  return result;
}

function splitZhSentences(zh: string): string[] {
  const normalized = zh.replace(/<br\s*\/?>/gi, "。").replace(/\n/g, "。");
  const parts = normalized.split("。");
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i].trim();
    if (!seg) continue;
    const endsWithPunct = /[。？！!?]$/.test(seg);
    const isLast = i === parts.length - 1;
    if (isLast || endsWithPunct) {
      result.push(seg);
    } else {
      result.push(seg + "。");
    }
  }
  return result;
}

/**
 * Approximate per-sentence start/end times within an audio clip.
 * Weights by stripped character count (HTML + whitespace removed) so longer
 * sentences get proportionally more time than short replies like 「はい。」.
 * Approximation (real data has pauses/accents that uniform rate misses); the
 * real alternative is re-running gpt-4o-transcribe with verbose_json to pull
 * segments + map them back to original jaHtml sentences.
 */
function computeSentenceTimings(
  audioDuration: number,
  sentences: string[]
): { start: number; end: number }[] {
  if (
    !isFinite(audioDuration) ||
    audioDuration <= 0 ||
    sentences.length === 0
  ) {
    return sentences.map(() => ({ start: 0, end: 0 }));
  }
  const weights = sentences.map((s) => {
    const stripped = s.replace(/<[^>]*>/g, "").replace(/\s+/g, "");
    return Math.max(stripped.length, 1);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const timings: { start: number; end: number }[] = [];
  let cursor = 0;
  for (let i = 0; i < sentences.length; i++) {
    const d = (weights[i] / totalWeight) * audioDuration;
    timings.push({ start: cursor, end: cursor + d });
    cursor += d;
  }
  return timings;
}

export default function RealShadowClient({
  sentences,
}: {
  sentences: MottoSentence[];
}) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<ShadowHistoryEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [grade, setGrade] = useState<ShadowGrade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [editableTranscript, setEditableTranscript] = useState("");
  const [isRegrading, setIsRegrading] = useState(false);
  const [isTranscriptEdited, setIsTranscriptEdited] = useState(false);
  const [nowPlaying, setNowPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [jumpInput, setJumpInput] = useState("");
  const [loopCurrent, setLoopCurrent] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const pendingAutoPlayRef = useRef(false);
  const sentenceRefs = useRef<(HTMLElement | null)[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  // Phase 1.5+ real-time session timer (per Frank #6175). Hook re-runs
  // when the user navigates between Shadowing and other pages, so each
  // session's time gets attributed to "shadowing" specifically.
  // Per Frank #6555: pass `nowPlaying` (audio playback) so timer only
  // counts when audio is playing — matches the page's core UX (audio
  // playback + shadowing the spoken text).
  // Frank #6643: 真人发音 time → 听力 bucket (no more separate "shadowing"
// timer type). Was `useSessionTimer("shadowing", nowPlaying)` when this
// lived at /shadowing. Renamed + retargeted to "listening" so accumulated
// minutes roll up into the 听力 daily total on /today + dashboard.
  const { elapsed: shadowElapsed } = useSessionTimer("listening", nowPlaying);

  const total = sentences.length;
  const cur = sentences[idx];
  const hasJaHtml = cur && cur.jaHtml && cur.jaHtml.length > 0;
  const hasZh = cur && cur.zh && cur.zh.length > 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(idx / PAGE_SIZE);
  const pageStart = currentPage * PAGE_SIZE + 1;
  const pageEnd = Math.min((currentPage + 1) * PAGE_SIZE, total);

  const jaSentences = useMemo(
    () => (hasJaHtml ? splitHtmlSentences(cur.jaHtml) : []),
    [cur, hasJaHtml]
  );
  const zhSentences = useMemo(
    () => (hasZh ? splitZhSentences(cur.zh) : []),
    [cur, hasZh]
  );

  const sentenceTimings = useMemo(
    () => computeSentenceTimings(duration, jaSentences),
    [duration, jaSentences]
  );
  const currentSentenceIdx = useMemo(() => {
    if (sentenceTimings.length === 0 || currentTime <= 0) return -1;
    let idx = -1;
    for (let i = 0; i < sentenceTimings.length; i++) {
      if (sentenceTimings[i].start <= currentTime + 0.01) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [sentenceTimings, currentTime]);

  // Boot
  useEffect(() => {
    setProgress(loadProgress());
    setHistory(loadShadowHistory());
    const prefs = loadPlaybackPrefs();
    setLoopCurrent(prefs.loopCurrent);
    setAutoNext(prefs.autoNext);
    setPlaybackRate(prefs.playbackRate);
    // Restore last played sentence (skip 0 — that's the default already)
    const saved = loadLastIdx();
    if (saved > 0 && saved < sentences.length) {
      setIdx(saved);
    }
  }, []);

  // Persist playback prefs whenever they change
  useEffect(() => {
    savePlaybackPrefs({ loopCurrent, autoNext, playbackRate });
  }, [loopCurrent, autoNext, playbackRate]);

  // Apply playback rate to current audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Persist current sentence idx so refresh keeps the same sentence
  useEffect(() => {
    saveLastIdx(idx);
  }, [idx]);

  // Auto-scroll the article so the current sentence stays in view as audio plays
  useEffect(() => {
    if (currentSentenceIdx < 0) return;
    const el = sentenceRefs.current[currentSentenceIdx];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentSentenceIdx]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* noop */
        }
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Reset when changing sentence
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setNowPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      if (pendingAutoPlayRef.current) {
        pendingAutoPlayRef.current = false;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.play().then(
          () => setNowPlaying(true),
          () => setNowPlaying(false)
        );
      }
    }
    setPhase("idle");
    setTranscript(null);
    setGrade(null);
    setError(null);
    setRecordingTime(0);
    setShowTranslation(false);
    setEditableTranscript("");
    setIsTranscriptEdited(false);
    setJumpInput("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const goNext = useCallback(() => {
    setIdx((i) => (i + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    setIdx((i) => (i - 1 + total) % total);
  }, [total]);

  const goToPage = useCallback(
    (page: number) => {
      const p = Math.max(0, Math.min(totalPages - 1, page));
      setIdx(p * PAGE_SIZE);
    },
    [totalPages]
  );

  const jumpToIdx = useCallback(
    (n: number) => {
      if (!Number.isFinite(n)) return;
      const clamped = Math.max(1, Math.min(total, Math.floor(n)));
      setIdx(clamped - 1);
    },
    [total]
  );

  const handleJump = useCallback(() => {
    const n = parseInt(jumpInput.trim(), 10);
    if (Number.isFinite(n) && n >= 1 && n <= total) {
      jumpToIdx(n);
      setJumpInput("");
    }
  }, [jumpInput, total, jumpToIdx]);

  const playAudio = useCallback(() => {
    if (!audioRef.current) return;
    if (nowPlaying) {
      audioRef.current.pause();
      setNowPlaying(false);
      return;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(
      () => setNowPlaying(true),
      (e) => setError(`播放失败：${e.message}`)
    );
  }, [nowPlaying]);

  // Mark as heard after first play completes
  const markHeard = useCallback(() => {
    setNowPlaying(false);
    const next = new Set(progress);
    next.add(cur.id);
    setProgress(next);
    saveProgress(next);
    // Auto-play next track if enabled (and not looping current)
    if (autoNext && !loopCurrent) {
      pendingAutoPlayRef.current = true;
      setIdx((i) => (i + 1) % total);
    }
  }, [progress, cur, autoNext, loopCurrent, total]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (!audioRef.current) return;
      const max = duration || seconds || 0;
      const t = Math.max(0, Math.min(max, seconds));
      audioRef.current.currentTime = t;
      setCurrentTime(t);
    },
    [duration]
  );

  const runShadowPipeline = useCallback(
    async (blob: Blob) => {
      setPhase("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        const tRes = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
        });
        if (!tRes.ok) {
          const j = (await tRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Transcribe HTTP ${tRes.status}`);
        }
        const tData = (await tRes.json()) as { text: string };
        setTranscript(tData.text);
        setEditableTranscript(tData.text);
        setIsTranscriptEdited(false);
        setPhase("grading");

        const gRes = await fetch("/api/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: tData.text,
            target: cur.ja,
            sentenceId: cur.id,
            categoryLabel: "真人发音",
          }),
        });
        if (!gRes.ok) {
          const j = (await gRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Grade HTTP ${gRes.status}`);
        }
        const gData = (await gRes.json()) as { grade: ShadowGrade };
        setGrade(gData.grade);
        setPhase("result");

        const entry: ShadowHistoryEntry = {
          id: Date.now().toString(),
          mottoId: cur.id,
          timestamp: Date.now(),
          transcript: tData.text,
          grade: gData.grade,
        };
        const newHistory = [entry, ...history].slice(0, 50);
        setHistory(newHistory);
        saveShadowHistory(newHistory);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("idle");
      }
    },
    [cur, history]
  );

  const startRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("当前浏览器不支持录音。请用 Chrome / Safari / Edge。");
      return;
    }
    setError(null);
    setTranscript(null);
    setGrade(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
      ];
      let chosenType = "";
      for (const t of supportedTypes) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
          chosenType = t;
          break;
        }
      }
      const recorder = chosenType
        ? new MediaRecorder(stream, { mimeType: chosenType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (cancelledRef.current) {
          cancelledRef.current = false;
          setPhase("idle");
          setRecordingTime(0);
          return;
        }
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        await runShadowPipeline(blob);
      };

      recordingStartRef.current = Date.now();
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        if (recordingStartRef.current) {
          setRecordingTime(
            Math.floor((Date.now() - recordingStartRef.current) / 1000)
          );
        }
      }, 250);
      recorder.start();
      setPhase("recording");
    } catch (e) {
      setError(
        e instanceof Error
          ? `麦克风权限被拒：${e.message}。请在浏览器地址栏旁的麦克风图标里允许。`
          : "麦克风权限被拒。请在浏览器设置里允许。"
      );
      setPhase("idle");
    }
  }, [runShadowPipeline]);

  const stopRecording = useCallback(() => {
    cancelledRef.current = false;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reGrade = useCallback(async () => {
    if (!editableTranscript.trim() || !cur) return;
    setIsRegrading(true);
    setError(null);
    try {
      const gRes = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: editableTranscript,
          target: cur.ja,
          sentenceId: cur.id,
          categoryLabel: "真人发音",
        }),
      });
      if (!gRes.ok) {
        const j = (await gRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Grade HTTP ${gRes.status}`);
      }
      const gData = (await gRes.json()) as { grade: ShadowGrade };
      setGrade(gData.grade);
      setHistory((prev) => {
        const idx2 = prev.findIndex(
          (e) => e.mottoId === cur.id && e.transcript === transcript
        );
        if (idx2 === -1) return prev;
        const next = [...prev];
        next[idx2] = {
          ...next[idx2],
          transcript: editableTranscript,
          grade: gData.grade,
        };
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRegrading(false);
    }
  }, [cur, editableTranscript, transcript]);

  const resetShadow = useCallback(() => {
    setTranscript(null);
    setGrade(null);
    setError(null);
    setPhase("idle");
    setEditableTranscript("");
    setIsTranscriptEdited(false);
  }, []);

  const shadowHistoryForCur = history.filter((e) => e.mottoId === cur.id);
  const heard = progress.has(cur.id);

  return (
    <main className="min-h-screen flex flex-col px-6 py-8 max-w-3xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link href="/today" className="text-sm text-gray-500 hover:text-gray-900">
          ← 今日训练
        </Link>
        <div className="flex items-center gap-3">
          <span
            aria-label="本次学习时长"
            className="text-sm text-gray-500 tabular-nums"
          >
            🕐 {formatDuration(shadowElapsed)}
          </span>
          <Link
            href="/listening"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            听力训练 →
          </Link>
        </div>
      </header>

      <h1 className="text-2xl font-bold mb-2">Shadowing 真人发音</h1>
      <p className="text-sm text-gray-500 mb-6">
        134 段真人日语对话（云端音频）· 听 → 跟读 → AI 评分（gpt-4o-transcribe + gpt-4o-mini）。
        真人发音比 TTS 自然 — 多角色语气、停顿、连读都更真实。
      </p>

      {/* Progress + pagination */}
      <div className="mb-3 text-xs text-gray-400">
        已听 {progress.size} / {total} · 当前第 {pageStart}-{pageEnd} 段
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm flex-shrink-0"
            aria-label="上一页"
          >
            ‹ 上一页
          </button>

          <div
            className="flex items-center gap-1 flex-wrap justify-center"
            role="navigation"
            aria-label="分页"
          >
            {Array.from({ length: totalPages }).map((_, p) => (
              <button
                key={p}
                type="button"
                onClick={() => goToPage(p)}
                aria-current={currentPage === p ? "page" : undefined}
                aria-label={`第 ${p + 1} 页`}
                className={`w-8 h-8 rounded text-sm transition-colors ${
                  currentPage === p
                    ? "bg-gray-900 text-white font-bold"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {p + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm flex-shrink-0"
            aria-label="下一页"
          >
            下一页 ›
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
          <span className="text-gray-500">跳转到第</span>
          <input
            type="number"
            min={1}
            max={total}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJump();
            }}
            placeholder={`${idx + 1}`}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:border-gray-500 focus:outline-none"
            aria-label="跳转到段号"
          />
          <span className="text-gray-500">段</span>
          <button
            type="button"
            onClick={handleJump}
            disabled={!jumpInput.trim()}
            className="px-3 py-1 bg-gray-900 text-white rounded text-sm hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            跳转
          </button>
        </div>
      </div>

      <section className="border border-gray-200 rounded-2xl p-6 mb-6 bg-white">
        <div className="text-xs text-gray-500 mb-4 flex items-center justify-between">
          <span>
            {cur.id} · {cur.prefix}
            {cur.filename}
          </span>
          {heard && <span className="text-green-600">✓ 听过了</span>}
        </div>

        {/* Japanese text — sentence by sentence, smaller font */}
        <div className="mb-5" lang="ja">
          {hasJaHtml ? (
            jaSentences.map((sentence, i) => (
              <p
                key={i}
                ref={(el) => {
                  sentenceRefs.current[i] = el;
                }}
                className={`text-base sm:text-lg font-medium leading-relaxed text-left py-1 px-2 break-words rounded transition-colors scroll-mt-32 ${
                  i === currentSentenceIdx ? "bg-yellow-100 text-gray-900" : ""
                }`}
                dangerouslySetInnerHTML={{ __html: sentence }}
              />
            ))
          ) : (
            <p className="text-base text-gray-400 italic text-center">
              (文字加载中…)
            </p>
          )}
        </div>

        {/* Translation — line by line */}
        <div className="flex flex-col items-center justify-center mb-6 min-h-[2.5rem]">
          {showTranslation && hasZh && zhSentences.length > 0 && (
            <div className="w-full max-w-xl space-y-1 mb-3">
              {zhSentences.map((sentence, i) => (
                <p
                  key={i}
                  className="text-sm text-gray-600 text-left leading-relaxed"
                >
                  {sentence}
                </p>
              ))}
            </div>
          )}
          {hasZh && (
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              aria-pressed={showTranslation}
              className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {showTranslation ? "🌐 隐藏翻译" : "🌐 显示翻译"}
            </button>
          )}
        </div>

        {/* Shadow controls */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-center gap-3">
            {phase !== "recording" ? (
              <button
                type="button"
                onClick={startRecording}
                className="px-6 py-3 rounded-lg text-base font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                🎤 跟读
              </button>
            ) : (
              <div className="w-full flex flex-col items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-red-700">🎙️ 正在录音</div>
                  <div className="text-base font-bold text-red-700 font-mono">
                    {recordingTime}s
                  </div>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-6 py-3 rounded-lg text-base font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  ⏹ 停止录音
                </button>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                >
                  取消
                </button>
              </div>
            )}
          </div>

          {phase === "transcribing" && (
            <div className="text-center text-sm text-gray-500 py-3 mt-3">🎙️ AI 转写中…</div>
          )}
          {phase === "grading" && (
            <div className="text-center text-sm text-gray-500 py-3 mt-3">🎯 AI 评分中…</div>
          )}

          {error && (
            <div className="mt-3 text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded-lg p-3">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Result card */}
        {phase === "result" && grade && (
          <div className="mt-6 border-t border-gray-200 pt-6 space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">你的转写</div>
              <div className="text-sm bg-gray-50 rounded-xl p-3 border border-gray-100 min-h-[3rem]" lang="ja">
                {transcript && transcript.trim() ? (
                  transcript
                ) : (
                  <span className="italic text-gray-400">(空白 — 没听清，请再试一次)</span>
                )}
              </div>
            </div>

            {/* Editable + re-grade */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  你的转写
                  {isTranscriptEdited && (
                    <span className="ml-2 text-orange-600 normal-case font-normal">
                      · 已修正
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={reGrade}
                  disabled={
                    isRegrading ||
                    !editableTranscript.trim() ||
                    !isTranscriptEdited
                  }
                  className="text-xs px-3 py-1 rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isRegrading ? "评分中…" : "✏️ 重新评分"}
                </button>
              </div>
              <textarea
                value={editableTranscript}
                onChange={(e) => {
                  setEditableTranscript(e.target.value);
                  setIsTranscriptEdited(e.target.value !== (transcript ?? ""));
                }}
                rows={3}
                className="w-full text-sm bg-gray-50 rounded-xl p-3 border border-gray-200 focus:border-gray-400 focus:outline-none resize-y"
                lang="ja"
                placeholder="STT 偶尔翻字，修改后点「重新评分」"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-700">{grade.accuracy}</div>
                <div className="text-xs text-blue-600 mt-1">准确度</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-700">{grade.fluency}</div>
                <div className="text-xs text-purple-600 mt-1">流畅度</div>
              </div>
            </div>

            {grade.feedback && (
              <div className="text-sm text-gray-800 bg-gray-50 rounded-xl p-4 leading-relaxed">
                {grade.feedback}
              </div>
            )}

            {grade.suggestions.length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">💡 改进建议</div>
                <ul className="text-sm space-y-1 list-disc pl-5 text-gray-700">
                  {grade.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {grade.encouragement && (
              <div className="text-sm italic text-gray-600 text-center bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                {grade.encouragement}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={resetShadow}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm"
              >
                🔁 再来一次
              </button>
              <button
                type="button"
                onClick={goNext}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm"
              >
                下一段 →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* History for current sentence */}
      {shadowHistoryForCur.length > 0 && (
        <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              本段 Shadow 记录 · {shadowHistoryForCur.length} 次
            </h3>
            <button
              type="button"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm(`清空本段 ${shadowHistoryForCur.length} 条 Shadow 记录？`)
                ) {
                  const newHistory = history.filter((e) => e.mottoId !== cur.id);
                  setHistory(newHistory);
                  saveShadowHistory(newHistory);
                }
              }}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              清空
            </button>
          </div>
          <div className="space-y-2">
            {shadowHistoryForCur.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-sm bg-gray-50 rounded-xl p-3 gap-3"
              >
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-xs text-gray-500 font-mono">
                    {formatTime(entry.timestamp)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-700 font-bold">{entry.grade.accuracy}</span>
                    <span className="text-gray-300">/</span>
                    <span className="text-purple-700 font-bold">{entry.grade.fluency}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 truncate min-w-0" lang="ja">
                  {entry.transcript ? (
                    entry.transcript
                  ) : (
                    <span className="italic text-gray-400">(空白)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 text-xs text-gray-400 text-center space-y-1">
        <div>🔊 真人发音 · Cloudflare R2 jp-audio bucket</div>
        <div>🎤 Shadow: gpt-4o-transcribe + gpt-4o-mini（中文反馈 · 历史进 localStorage）</div>
      </div>

      {/* Sticky bottom audio player */}
      <div className="sticky bottom-0 z-50 bg-white border-t border-gray-200 shadow-md -mx-6 px-6 py-3 mt-6">
        <audio
          ref={audioRef}
          src={cur.audioUrl}
          preload="metadata"
          loop={loopCurrent}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration || 0);
            if (e.currentTarget) e.currentTarget.playbackRate = playbackRate;
          }}
          onTimeUpdate={(e) =>
            setCurrentTime(e.currentTarget.currentTime || 0)
          }
          onEnded={markHeard}
          onPause={() => setNowPlaying(false)}
          onPlay={() => setNowPlaying(true)}
        >
          <track kind="captions" srcLang="ja" label="Japanese" />
        </audio>

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <button
            type="button"
            onClick={goPrev}
            className="w-9 h-9 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center text-lg flex-shrink-0"
            title="上一段"
            aria-label="上一段"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={playAudio}
            className={`w-11 h-11 rounded-full text-white transition-colors flex items-center justify-center flex-shrink-0 text-base ${
              nowPlaying
                ? "bg-red-500 hover:bg-red-600"
                : "bg-gray-900 hover:bg-gray-800"
            }`}
            title={nowPlaying ? "暂停" : "播放"}
            aria-label={nowPlaying ? "暂停" : "播放"}
          >
            {nowPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="w-9 h-9 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center text-lg flex-shrink-0"
            title="下一段"
            aria-label="下一段"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setLoopCurrent((v) => !v)}
            aria-pressed={loopCurrent}
            title={loopCurrent ? "单篇循环 · 开" : "单篇循环 · 关"}
            aria-label="单篇循环"
            className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm flex-shrink-0 transition-colors ${
              loopCurrent
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-gray-300 text-gray-500 hover:bg-gray-50"
            }`}
          >
            ↻
          </button>
          <button
            type="button"
            onClick={() => setAutoNext((v) => !v)}
            aria-pressed={autoNext}
            title={autoNext ? "自动播放下一篇 · 开" : "自动播放下一篇 · 关"}
            aria-label="自动播放下一篇"
            className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm flex-shrink-0 transition-colors ${
              autoNext
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-gray-300 text-gray-500 hover:bg-gray-50"
            }`}
          >
            ⏭
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-400 truncate">
              {cur.id} · {cur.prefix}
              {cur.filename}
            </div>
            <div className="text-sm font-medium text-gray-900">
              第 {idx + 1} 段 / 共 {total} 段
            </div>
          </div>

          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            className="text-xs px-2 py-1 border border-gray-300 rounded bg-white focus:border-gray-500 focus:outline-none flex-shrink-0"
            aria-label="语速"
          >
            <option value="1.0">1.0x</option>
            <option value="1.1">1.1x</option>
            <option value="1.2">1.2x</option>
          </select>

          <div className="text-xs font-mono text-gray-500 flex-shrink-0 tabular-nums">
            {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          className="w-full h-1 accent-gray-900 cursor-pointer"
          aria-label="音频进度"
        />
      </div>
    </main>
  );
}
