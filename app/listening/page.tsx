"use client";

import { Suspense, useEffect, useRef, useState } from "react";

// Force dynamic rendering — useSearchParams() inside ListeningPageContent
// is not compatible with static prerendering even inside a Suspense boundary
// in this Next.js 15 build. opt out of SSG for this route.
export const dynamic = "force-dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type Difficulty,
  type Sentence,
  type Category,
  CATEGORIES,
  LEVELS,
  CATEGORY_LABELS,
} from "@/lib/sentences";
import { useSessionTimer, formatDuration } from "@/lib/today-stats";

const PROGRESS_KEY = "japanese:listen-progress";
const SHADOW_HISTORY_KEY = "japanese:shadow-history";

type ShadowGrade = {
  accuracy: number;
  fluency: number;
  feedback: string;
  suggestions: string[];
  encouragement: string;
};

type ShadowHistoryEntry = {
  id: string;
  sentenceId: string;
  categoryId: string;
  timestamp: number;
  transcript: string;
  grade: ShadowGrade;
};

function loadProgress(): Record<string, Set<string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const result: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[k] = new Set(v);
    }
    return result;
  } catch {
    return {};
  }
}

function saveProgress(progress: Record<string, Set<string>>) {
  if (typeof window === "undefined") return;
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(progress)) {
    out[k] = Array.from(v);
  }
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(out));
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

function saveShadowHistory(history: ShadowHistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SHADOW_HISTORY_KEY,
    JSON.stringify(history.slice(0, 50))
  );
}

function formatHistoryTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Phase 1 enhancement: split Japanese text into tokens (words) + separators
// (particles, punctuation, whitespace). Used by the word-level diff display.
function tokenizeWithSeparators(
  text: string
): { word: string; isSeparator: boolean }[] {
  return text
    .split(/([、。「」!?\s]+)/)
    .filter((p) => p.length > 0)
    .map((p) => ({
      word: p,
      isSeparator: /^[、。「」!?\s]+$/.test(p),
    }));
}

// Phase 1 enhancement: compare target sentence against transcript at the word level.
// Returns the tokens (for rendering), and the matched/missed sets (for stats).
function computeWordDiff(
  target: string,
  transcript: string
): {
  tokens: { word: string; isSeparator: boolean }[];
  matched: string[];
  missed: string[];
} {
  const tokens = tokenizeWithSeparators(target);
  const transcriptWords = new Set(
    transcript.split(/[、。「」!?\s]+/).filter(Boolean)
  );
  const matched: string[] = [];
  const missed: string[] = [];
  for (const tok of tokens) {
    if (tok.isSeparator) continue;
    if (transcriptWords.has(tok.word) || transcript.includes(tok.word)) {
      matched.push(tok.word);
    } else {
      missed.push(tok.word);
    }
  }
  return { tokens, matched, missed };
}

// Phase 4: chunk Japanese sentence by 読点/句点 (、。); fall back to fixed-length chunks
// when no punctuation is present. Returns at least one chunk for any non-empty input.
function chunkJapanese(ja: string): string[] {
  if (!ja || !ja.trim()) return [];
  const parts = ja.split(/[、。]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  const result: string[] = [];
  for (let i = 0; i < ja.length; i += 6) {
    result.push(ja.slice(i, i + 6));
  }
  return result;
}

// Phase 5: look up a sentence by its id across all (category × difficulty) buckets.
// Phase 6: iterate over LEVELS (N5/N4/N3/N2/N1).
function findSentenceById(sentenceId: string): Sentence | null {
  for (const cat of CATEGORIES) {
    for (const lvl of LEVELS) {
      const sent = cat[lvl].find((s) => s.id === sentenceId);
      if (sent) return sent;
    }
  }
  return null;
}

// Phase 5: small stat tile used in the 📊 panel.
function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "blue" | "purple";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-700"
      : tone === "purple"
        ? "text-purple-700"
        : "text-gray-900";
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
      <div className={`text-xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

const RATE_OPTIONS = [
  { v: 0.7, label: "0.7x", desc: "慢速" },
  { v: 0.9, label: "0.9x", desc: "常速" },
  { v: 1.0, label: "1.0x", desc: "原速" },
] as const;

type Mode = "listen" | "shadow";
type ShadowPhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "grading"
  | "result";

export default function ListeningPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-gray-500">加载中…</div>
      }
    >
      <ListeningPageContent />
    </Suspense>
  );
}

function ListeningPageContent() {
  const [mode, setMode] = useState<Mode>(() => {
    // Deep-link support: /today's "Shadowing" item links to
    // /listening?mode=shadow so the user lands directly in Shadow mode
    // (no need to click the Shadow tab manually). Lazy init avoids a
    // "flash of listen mode" on first paint.
    if (typeof window === "undefined") return "listen";
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "shadow" ? "shadow" : "listen";
  });

  // Real-time session timer (per Frank #6175). When the user toggles
  // between Listen and Shadow, the hook re-runs (because `type` is in
  // its dependency list), the cleanup fires, and elapsed time gets
  // attributed to the previous mode before the new session starts.
  const sessionType =
    mode === "shadow" ? "shadowing" : "listening";
  const { elapsed } = useSessionTimer(sessionType, speaking);

  // Difficulty level (N5/N4/N3/N2/N1) — index into LEVELS array.
  const [levelIdx, setLevelIdx] = useState<0 | 1 | 2 | 3 | 4>(0);

  // Listen state (preserved from Phase 1)
  const [categoryIdx, setCategoryIdx] = useState(0);
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [rate, setRate] = useState<number>(0.9);
  const [speaking, setSpeaking] = useState(false);
  const [progress, setProgress] = useState<Record<string, Set<string>>>({});
  const [browserSupportsTts, setBrowserSupportsTts] = useState(true);

  // Shadow state
  const [shadowHistory, setShadowHistory] = useState<ShadowHistoryEntry[]>([]);
  const [shadowPhase, setShadowPhase] = useState<ShadowPhase>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [grade, setGrade] = useState<ShadowGrade | null>(null);
  const [shadowError, setShadowError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  // Phase 2: editable transcript (user can fix STT errors before re-grading).
  const [editableTranscript, setEditableTranscript] = useState<string>("");
  const [isTranscriptEdited, setIsTranscriptEdited] = useState(false);
  // Phase 2: re-grade in progress (separate boolean to avoid TypeScript
  // narrowing issues — the result section is already conditional on
  // `shadowPhase === "result"`, so checking `shadowPhase === "grading"` inside
  // would always be false).
  const [isRegrading, setIsRegrading] = useState(false);
  // Per Frank #6338: translation toggle — hidden until user clicks, so the
  // learner tries to understand the Japanese sentence first.
  const [showTranslation, setShowTranslation] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakCancelRef = useRef(false);

  // Phase 7 (#6257): real-time volume waveform during recording.
  // AudioContext + AnalyserNode read the mic stream's frequency data on
  // requestAnimationFrame; volumeLevel drives the 7 staggered bars in JSX.
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeFrameRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  // Phase 7 (#6269): raw waveform path element. Direct DOM mutation on
  // each animation frame — avoids 60fps React re-renders.
  const waveformPathRef = useRef<SVGPathElement | null>(null);

  // Shadow chunked mode (Phase 4): play sentence in chunks with 1.5s delay between.
  const [chunkedMode, setChunkedMode] = useState(false);
  const [currentChunkIdx, setCurrentChunkIdx] = useState(-1);

  const DIFFICULTIES: readonly Difficulty[] = LEVELS;
  const category = CATEGORIES[categoryIdx];
  const currentDifficulty = DIFFICULTIES[levelIdx];
  const currentSentences = category[currentDifficulty];
  const sentence = currentSentences[sentenceIdx];
  const totalInCat = currentSentences.length;
  const completedInCat = progress[category.id]?.size || 0;
  const totalCompleted = Object.values(progress).reduce(
    (sum, set) => sum + set.size,
    0
  );
  const allDone = totalCompleted >= 150;
  const shadowHistoryForSentence = shadowHistory.filter(
    (e) => e.sentenceId === sentence.id
  );
  const chunks = (chunkedMode && mode === "shadow")
    ? chunkJapanese(sentence.ja)
    : [];

  // Phase 1 enhancement: word-level diff between target and transcript.
  // Null when not in Shadow result phase (or transcript missing).
  const wordDiff =
    mode === "shadow" && shadowPhase === "result" && transcript
      ? computeWordDiff(sentence.ja, transcript)
      : null;

  // Phase 3 enhancement: previous attempt lookup (for delta display).
  // shadowHistory is already sorted newest first; the [0] entry is the
  // current attempt (just added or just re-graded), so [1] is the previous
  // attempt for this same sentence.
  const sameSentenceEntries =
    mode === "shadow" && shadowPhase === "result" && transcript
      ? shadowHistory.filter((e) => e.sentenceId === sentence.id)
      : [];
  const previousAttempt = sameSentenceEntries[1] ?? null;

  const accuracyDelta =
    grade && previousAttempt
      ? grade.accuracy - previousAttempt.grade.accuracy
      : null;

  const fluencyDelta =
    grade && previousAttempt
      ? grade.fluency - previousAttempt.grade.fluency
      : null;

  // Phase 5: aggregate Shadow stats (trends).
  const shadowStats = (() => {
    const total = shadowHistory.length;
    if (total === 0) {
      return {
        total: 0,
        avgAcc: 0,
        avgFlu: 0,
        best: null as ShadowHistoryEntry | null,
        byLevel: { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 } as Record<Difficulty, number>,
        byLevelAcc: { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 } as Record<Difficulty, number>,
      };
    }
    const sumAcc = shadowHistory.reduce((s, e) => s + e.grade.accuracy, 0);
    const sumFlu = shadowHistory.reduce((s, e) => s + e.grade.fluency, 0);
    const best = shadowHistory.reduce(
      (bestE, e) =>
        e.grade.accuracy > (bestE?.grade.accuracy ?? -1) ? e : bestE,
      shadowHistory[0]
    );

    const byLevel: Record<Difficulty, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
    const byLevelAcc: Record<Difficulty, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
    for (const e of shadowHistory) {
      const m = e.sentenceId.match(/-n([54321])-\d+$/);
      if (m) {
        const lvl = `N${m[1]}` as Difficulty;
        byLevel[lvl] += 1;
        byLevelAcc[lvl] += e.grade.accuracy;
      }
    }
    return {
      total,
      avgAcc: Math.round(sumAcc / total),
      avgFlu: Math.round(sumFlu / total),
      best,
      byLevel,
      byLevelAcc,
    };
  })();

  // Boot: detect browser APIs + load saved state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setBrowserSupportsTts(Boolean(window.speechSynthesis));
    setProgress(loadProgress());
    setShadowHistory(loadShadowHistory());
  }, []);

  // Phase 5 enhancement: read ?c=<categoryId> from URL and pre-select that
  // category. Lets /today's "去练习" link deep-link to the right category.
  // Run once on mount (empty deps) so we don't reset the user's position if
  // they manually switch categories afterwards.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("c");
    if (!cat) return;
    const idx = CATEGORIES.findIndex((c) => c.id === cat);
    if (idx >= 0) {
      setCategoryIdx(idx);
      setSentenceIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore — recorder may already have ended
        }
      }
      setSpeaking(false);
    };
  }, []);

  // Reset Shadow state whenever the active sentence changes.
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setShadowPhase("idle");
    setTranscript(null);
    setGrade(null);
    setShadowError(null);
    setRecordingTime(0);
    setSpeaking(false);
    // Per Frank #6338: reset translation toggle when sentence changes so
    // each new sentence starts hidden (forces learner to read Japanese).
    setShowTranslation(false);
    // intentionally only depending on sentence/category/level idx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryIdx, sentenceIdx, levelIdx]);

  function stopSpeech() {
    speakCancelRef.current = true;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setCurrentChunkIdx(-1);
  }

  function switchMode(next: Mode) {
    stopSpeech();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setMode(next);
    setShadowPhase("idle");
    setTranscript(null);
    setGrade(null);
    setShadowError(null);
    setRecordingTime(0);
  }

  function changeCategory(i: number) {
    setCategoryIdx(i);
    setSentenceIdx(0);
    stopSpeech();
  }

  function setRateAndCancel(r: number) {
    if (speaking) stopSpeech();
    setRate(r);
  }

  function speak() {
    if (!browserSupportsTts) {
      alert("当前浏览器不支持语音合成。请用 Chrome 或 Safari。");
      return;
    }
    if (speaking) {
      stopSpeech();
      return;
    }
    speakCancelRef.current = false;
    window.speechSynthesis.cancel();

    const useChunked = chunkedMode && mode === "shadow";
    const pieces = useChunked ? chunkJapanese(sentence.ja) : [sentence.ja];
    let pieceIdx = 0;
    setCurrentChunkIdx(useChunked ? 0 : -1);
    setSpeaking(true);

    const playNext = () => {
      if (speakCancelRef.current || pieceIdx >= pieces.length) {
        setSpeaking(false);
        setCurrentChunkIdx(-1);
        return;
      }
      if (useChunked) setCurrentChunkIdx(pieceIdx);
      const u = new SpeechSynthesisUtterance(pieces[pieceIdx]);
      u.lang = "ja-JP";
      u.rate = rate;
      u.onend = () => {
        setCurrentChunkIdx(-1);
        pieceIdx++;
        if (useChunked && pieceIdx < pieces.length) {
          // 1.5s pause between chunks; bail if cancelled during the pause.
          setTimeout(() => {
            if (speakCancelRef.current) {
              setSpeaking(false);
              setCurrentChunkIdx(-1);
              return;
            }
            playNext();
          }, 1500);
        } else {
          setSpeaking(false);
          setCurrentChunkIdx(-1);
        }
      };
      u.onerror = () => {
        setSpeaking(false);
        setCurrentChunkIdx(-1);
      };
      window.speechSynthesis.speak(u);
    };

    playNext();

    // Mark sentence as listened (Listen mode only).
    if (mode === "listen") {
      const newProgress: Record<string, Set<string>> = {};
      for (const [k, v] of Object.entries(progress)) {
        newProgress[k] = new Set(v);
      }
      if (!newProgress[category.id]) newProgress[category.id] = new Set();
      newProgress[category.id].add(sentence.id);
      setProgress(newProgress);
      saveProgress(newProgress);
    }
  }

  function next() {
    stopSpeech();
    if (sentenceIdx < totalInCat - 1) {
      setSentenceIdx(sentenceIdx + 1);
    } else if (categoryIdx < CATEGORIES.length - 1) {
      setCategoryIdx(categoryIdx + 1);
      setSentenceIdx(0);
    } else {
      // Last sentence in last category — loop to start of current cat.
      setSentenceIdx(0);
    }
  }

  function prev() {
    stopSpeech();
    if (sentenceIdx > 0) {
      setSentenceIdx(sentenceIdx - 1);
    } else if (categoryIdx > 0) {
      const prevCat = CATEGORIES[categoryIdx - 1];
      setCategoryIdx(categoryIdx - 1);
      setSentenceIdx(prevCat[currentDifficulty].length - 1);
    } else {
      setSentenceIdx(totalInCat - 1);
    }
  }

  async function startShadowRecording() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setShadowError("当前浏览器不支持录音。请用 Chrome / Safari / Edge。");
      return;
    }
    setShadowError(null);
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
        if (
          typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported(t)
        ) {
          chosenType = t;
          break;
        }
      }
      const recorder = chosenType
        ? new MediaRecorder(stream, { mimeType: chosenType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startVolumeMeter(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stopVolumeMeter();
        // Cancel discards the recording before onstop fires; bail out of
        // the pipeline so we don't waste a transcribe call.
        if (cancelledRef.current) {
          cancelledRef.current = false;
          setShadowPhase("idle");
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
      setShadowPhase("recording");
    } catch (e) {
      setShadowError(
        e instanceof Error
          ? `麦克风权限被拒：${e.message}。请在浏览器地址栏旁的麦克风图标里允许。`
          : "麦克风权限被拒。请在浏览器设置里允许。"
      );
      setShadowPhase("idle");
    }
  }

  function stopShadowRecording() {
    cancelledRef.current = false;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }

  // Phase 7 (#6257): cancel — drop the current recording without
  // transcoding/grading. Sets a flag so recorder.onstop knows to skip
  // the pipeline and clean up. Also kills the volume meter.
  function cancelShadowRecording() {
    cancelledRef.current = true;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }

  // Phase 7 (#6257): real-time volume waveform.
  // AudioContext reads frequency data from the mic stream on
  // requestAnimationFrame; the average level (0-1) drives the 7
  // staggered bars in the JSX.
  function startVolumeMeter(stream: MediaStream) {
    try {
      const Ctor =
        (window as any).AudioContext ||
        (window as any).webkitAudioContext;
      if (!Ctor) return;
      const audioContext: AudioContext = new Ctor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!analyserRef.current) return;
        // Phase 7 (#6269): raw waveform — getByteTimeDomainData returns
        // PCM samples (0-255, centered at 128 = silence). Build an SVG
        // path string of all 256 samples and mutate the path element
        // directly via ref so we don't re-render React at 60fps.
        analyserRef.current.getByteTimeDomainData(data);
        const w = 280;
        const h = 32;
        const mid = h / 2;
        const sliceWidth = w / data.length;
        let path = "";
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0; // 0-2, 1.0 = silence
          const y = mid - (v - 1) * mid; // 0-2 → -mid to +mid (inverted)
          const x = i * sliceWidth;
          if (i === 0) path += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
          else path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
        }
        if (waveformPathRef.current) {
          waveformPathRef.current.setAttribute("d", path);
        }
        volumeFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.error("volume meter failed:", e);
    }
  }

  function stopVolumeMeter() {
    if (volumeFrameRef.current) {
      cancelAnimationFrame(volumeFrameRef.current);
      volumeFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (waveformPathRef.current) {
      waveformPathRef.current.setAttribute("d", "");
    }
  }

  async function runShadowPipeline(blob: Blob) {
    setShadowPhase("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const tRes = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      if (!tRes.ok) {
        const j = (await tRes
          .json()
          .catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Transcribe HTTP ${tRes.status}`);
      }
      const tData = (await tRes.json()) as { text: string };
      setTranscript(tData.text);
      setEditableTranscript(tData.text);
      setIsTranscriptEdited(false);
      setShadowPhase("grading");

      const gRes = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: tData.text,
          target: sentence.ja,
          sentenceId: sentence.id,
          categoryLabel: category.label,
        }),
      });
      if (!gRes.ok) {
        const j = (await gRes
          .json()
          .catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Grade HTTP ${gRes.status}`);
      }
      const gData = (await gRes.json()) as { grade: ShadowGrade };
      setGrade(gData.grade);
      setShadowPhase("result");

      // Save to history (latest first, cap at 50).
      const entry: ShadowHistoryEntry = {
        id: Date.now().toString(),
        sentenceId: sentence.id,
        categoryId: category.id,
        timestamp: Date.now(),
        transcript: tData.text,
        grade: gData.grade,
      };
      const newHistory = [entry, ...shadowHistory].slice(0, 50);
      setShadowHistory(newHistory);
      saveShadowHistory(newHistory);
    } catch (e) {
      setShadowError(e instanceof Error ? e.message : String(e));
      setShadowPhase("idle");
    }
  }

  function resetShadow() {
    setTranscript(null);
    setGrade(null);
    setShadowError(null);
    setShadowPhase("idle");
    setEditableTranscript("");
    setIsTranscriptEdited(false);
  }

  // Phase 2: re-grade with user-edited transcript (without re-recording audio).
  async function reGradeWithEditedTranscript() {
    if (!editableTranscript.trim() || !sentence) return;
    setIsRegrading(true);
    setShadowError(null);
    try {
      const gRes = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: editableTranscript,
          target: sentence.ja,
          sentenceId: sentence.id,
          categoryLabel: category.label,
        }),
      });
      if (!gRes.ok) {
        const j = (await gRes
          .json()
          .catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Grade HTTP ${gRes.status}`);
      }
      const gData = (await gRes.json()) as { grade: ShadowGrade };
      setGrade(gData.grade);
      // Update history entry (if id matches) so the corrected transcript + grade
      // are persisted in the localStorage history.
      setShadowHistory((prev) => {
        const idx = prev.findIndex(
          (e) => e.sentenceId === sentence.id && e.transcript === transcript
        );
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          transcript: editableTranscript,
          grade: gData.grade,
        };
        return next;
      });
    } catch (e) {
      setShadowError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRegrading(false);
    }
  }

  const sentenceHeard = progress[category.id]?.has(sentence.id) ?? false;

  return (
    <main className="min-h-screen flex flex-col px-6 py-8 max-w-3xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/today"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 今日训练
        </Link>
        <div className="flex items-center gap-3">
          <span
            aria-label="本次学习时长"
            className="text-sm text-gray-500 tabular-nums"
          >
            🕐 {formatDuration(elapsed)}
          </span>
          <Link
            href="/speaking"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            口语训练 →
          </Link>
        </div>
      </header>

      <h1 className="text-2xl font-bold mb-2">
        {mode === "listen" ? "听力训练" : "跟读训练"}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {mode === "listen"
          ? "听 AI 朗读：5 场景 × 5 难度 × 6 句 = 150 句 N5/N4/N3/N2/N1 起步。所有汉字标假名（振り仮名）。点 🔊 听、慢速 / 常速切换、上一句 / 下一句。"
          : "跟 AI 读：先点 ▶ 听 AI 示范 → 点 🎤 跟读 → 录完自动评分 → 显示结果卡。"}
      </p>

      {/* Mode tabs (Listen vs Shadow) */}
      <div
        className="flex gap-2 mb-4"
        role="tablist"
        aria-label="训练模式"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "listen"}
          onClick={() => switchMode("listen")}
          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors ${
            mode === "listen"
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          🎧 Listen
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "shadow"}
          onClick={() => switchMode("shadow")}
          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors ${
            mode === "shadow"
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          🎤 Shadow 跟读
        </button>
      </div>

      {/* Difficulty tabs (N5 / N4 / N3 / N2 / N1) — Phase 6 */}
      <div
        className="flex gap-2 mb-4 flex-wrap"
        role="tablist"
        aria-label="难度"
      >
        {(
          [
            { v: 0, label: "N5 入门", emoji: "🌱" },
            { v: 1, label: "N4 初级", emoji: "🌿" },
            { v: 2, label: "N3 中级", emoji: "🌳" },
            { v: 3, label: "N2 中高级", emoji: "🌲" },
            { v: 4, label: "N1 高级", emoji: "🏔️" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.v}
            type="button"
            role="tab"
            aria-selected={levelIdx === opt.v}
            onClick={() => {
              setLevelIdx(opt.v);
              setSentenceIdx(0);
              stopSpeech();
            }}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors ${
              levelIdx === opt.v
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span className="mr-1">{opt.emoji}</span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Category tabs (shared by both modes) */}
      <div
        className="flex gap-2 mb-6 overflow-x-auto pb-2"
        role="tablist"
        aria-label="场景分类"
      >
        {CATEGORIES.map((c, i) => {
          const done = progress[c.id]?.size || 0;
          const total = c[currentDifficulty].length;
          const allListened = done === total && total > 0;
          const active = i === categoryIdx;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              onClick={() => changeCategory(i)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : allListened
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span className="mr-1">{c.emoji}</span>
              {c.label}
              {allListened && <span className="ml-1">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Sentence card */}
      <section className="border border-gray-200 rounded-2xl p-6 mb-6 bg-white">
        <div className="text-sm text-gray-500 mb-3 flex items-center justify-between">
          <span>
            {category.label} · 第 {sentenceIdx + 1} / {totalInCat} 句
          </span>
          {mode === "listen" && sentenceHeard && (
            <span className="text-xs text-green-600">✓ 听过了</span>
          )}
        </div>

        <div
          className="text-3xl font-bold mb-4 leading-loose text-left py-4 break-words"
          lang="ja"
        >
          {chunkedMode && mode === "shadow" && chunks.length > 0 ? (
            chunks.map((chunk, i) => (
              <span
                key={i}
                className={`inline-block mx-1 transition-colors px-1 rounded ${
                  i === currentChunkIdx
                    ? "bg-yellow-200 text-gray-900"
                    : i < currentChunkIdx
                      ? "text-gray-400"
                      : "text-gray-900"
                }`}
              >
                {chunk}
              </span>
            ))
          ) : (
            // Phase 6: render jaHtml with <ruby> furigana annotations.
            // Safe — content is hand-authored; only <ruby>/<rt> tags used.
            <span dangerouslySetInnerHTML={{ __html: sentence.jaHtml }} />
          )}
        </div>

        {/* Per Frank #6338: translation toggle (default hidden).
           Default state hides zh so the learner must first try to
           understand the Japanese sentence; click "🌐 显示翻译" to
           reveal the Chinese translation. Button stays visible so the
           user always knows the affordance is there. */}
        <div className="flex flex-col items-center justify-center mb-6 min-h-[2.5rem]">
          {showTranslation && (
            <div className="text-base text-gray-600 text-left mb-2">
              {sentence.zh}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowTranslation((v) => !v)}
            aria-pressed={showTranslation}
            className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {showTranslation ? "🌐 隐藏翻译" : "🌐 显示翻译"}
          </button>
        </div>

        {mode === "listen" ? (
          /* ─── Listen controls ─── */
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              type="button"
              onClick={speak}
              disabled={!browserSupportsTts}
              className={`px-6 py-3 rounded-lg text-base font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                speaking
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              {speaking ? "⏹ 停止" : "🔊 听"}
            </button>

            <div
              className="inline-flex rounded-lg border border-gray-200 overflow-hidden self-center"
              role="group"
              aria-label="语速"
            >
              {RATE_OPTIONS.map((opt, i) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setRateAndCancel(opt.v)}
                  className={`px-3 py-3 text-sm transition-colors ${
                    i > 0 ? "border-l border-gray-200" : ""
                  } ${
                    rate === opt.v
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title={`${opt.desc} ${opt.label}`}
                  aria-pressed={rate === opt.v}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ─── Shadow controls ─── */
          <div>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
              <button
                type="button"
                onClick={speak}
                disabled={
                  !browserSupportsTts || shadowPhase === "recording"
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  speaking
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                title="先听 AI 示范"
              >
                {speaking ? "⏹ 停止" : "▶ 听 AI"}
              </button>

              {shadowPhase !== "recording" ? (
                <button
                  type="button"
                  onClick={startShadowRecording}
                  className="px-6 py-3 rounded-lg text-base font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                >
                  🎤 跟读
                </button>
              ) : (
                <div className="w-full flex flex-col items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-red-700">
                      🎙️ 正在录音
                    </div>
                    <div className="text-base font-bold text-red-700 font-mono">
                      {recordingTime}s
                    </div>
                  </div>
                  {/* Phase 7 (#6269): raw waveform.
                     SVG path of 256 PCM samples (0-255, centered at 128 = silence).
                     The path's `d` attribute is mutated directly via ref on
                     requestAnimationFrame — no React re-render at 60fps. */}
                  <svg
                    width={280}
                    height={32}
                    viewBox="0 0 280 32"
                    className="block"
                    aria-hidden="true"
                  >
                    <path
                      ref={waveformPathRef}
                      d=""
                      stroke="rgb(239, 68, 68)"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <button
                    type="button"
                    onClick={stopShadowRecording}
                    className="px-6 py-3 rounded-lg text-base font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    ⏹ 停止录音
                  </button>
                  <button
                    type="button"
                    onClick={cancelShadowRecording}
                    className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                  >
                    取消
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setChunkedMode(!chunkedMode)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  chunkedMode
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
                title="切 chunk 顺序播放（每段之间 1.5s 停顿）"
              >
                🎵 Chunked {chunkedMode ? "ON" : "OFF"}
              </button>
            </div>

            {shadowPhase === "transcribing" && (
              <div className="text-center text-sm text-gray-500 py-3">
                🎙️ AI 转写中…
              </div>
            )}
            {shadowPhase === "grading" && (
              <div className="text-center text-sm text-gray-500 py-3">
                🎯 AI 评分中…
              </div>
            )}

            {shadowError && (
              <div className="mt-3 text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded-lg p-3">
                ⚠️ {shadowError}
              </div>
            )}
          </div>
        )}

        {/* Shadow result card (inline below controls) */}
        {mode === "shadow" && shadowPhase === "result" && grade && (
          <div className="mt-6 border-t border-gray-200 pt-6 space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
                你的转写
              </div>
              <div
                className="text-sm bg-gray-50 rounded-xl p-3 border border-gray-100 min-h-[3rem]"
                lang="ja"
              >
                {transcript && transcript.trim() ? (
                  transcript
                ) : (
                  <span className="italic text-gray-400">
                    (空白 — 没听清，请再试一次)
                  </span>
                )}
              </div>
            </div>

            {/* Phase 1 enhancement:逐字对照 (target vs transcript) */}
            {wordDiff && (
              <div>
                <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
                  逐字对照 · 命中 {wordDiff.matched.length} /{" "}
                  {wordDiff.matched.length + wordDiff.missed.length}
                </div>
                <div
                  className="text-base bg-gray-50 rounded-xl p-3 leading-relaxed"
                  lang="ja"
                >
                  {wordDiff.tokens.map((tok, i) => {
                    const cls = tok.isSeparator
                      ? "text-gray-500"
                      : wordDiff.matched.includes(tok.word)
                        ? "text-green-700"
                        : "text-red-600 line-through";
                    return (
                      <span key={i} className={cls}>
                        {tok.word}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Phase 2: editable transcript + re-grade button */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  你的转写{isTranscriptEdited && (
                    <span className="ml-2 text-orange-600 normal-case font-normal">
                      · 已修正
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={reGradeWithEditedTranscript}
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

            {/* Phase 3 enhancement:对比上次 attempt */}
            {previousAttempt &&
              (accuracyDelta !== null || fluencyDelta !== null) && (
                <div className="text-xs text-gray-500 text-center">
                  <span className="text-gray-400">对比上次</span> ·{" "}
                  {previousAttempt.grade.accuracy} /{" "}
                  {previousAttempt.grade.fluency}
                  {accuracyDelta !== null && accuracyDelta !== 0 && (
                    <span
                      className={`ml-2 ${
                        accuracyDelta > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      准{accuracyDelta > 0 ? " ↑" : " ↓"}
                      {Math.abs(accuracyDelta)}
                    </span>
                  )}
                  {fluencyDelta !== null && fluencyDelta !== 0 && (
                    <span
                      className={`ml-2 ${
                        fluencyDelta > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      流{fluencyDelta > 0 ? " ↑" : " ↓"}
                      {Math.abs(fluencyDelta)}
                    </span>
                  )}
                </div>
              )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-700">
                  {grade.accuracy}
                </div>
                <div className="text-xs text-blue-600 mt-1">准确度</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-700">
                  {grade.fluency}
                </div>
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
                <div className="text-sm font-medium text-gray-700 mb-2">
                  💡 改进建议
                </div>
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
                onClick={next}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm"
              >
                下一句 →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Phase 5: Shadow stats / trends panel */}
      {mode === "shadow" && shadowStats.total > 0 && (
        <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              📊 Shadow 统计 · 共 {shadowStats.total} 条
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatTile label="总录音" value={`${shadowStats.total}`} />
            <StatTile
              label="平均准确度"
              value={`${shadowStats.avgAcc}`}
              tone="blue"
            />
            <StatTile
              label="平均流畅度"
              value={`${shadowStats.avgFlu}`}
              tone="purple"
            />
          </div>
          <div className="space-y-1 text-xs">
            <div className="text-gray-500 mb-1">按难度：</div>
            {(["N5", "N4", "N3", "N2", "N1"] as Difficulty[]).map((lvl) => {
              const cnt = shadowStats.byLevel[lvl];
              if (cnt === 0) return null;
              const acc = Math.round(shadowStats.byLevelAcc[lvl] / cnt);
              return (
                <div
                  key={lvl}
                  className="flex items-center justify-between text-gray-700"
                >
                  <span>{lvl}</span>
                  <span>
                    {cnt} 条 · 准 {acc}
                  </span>
                </div>
              );
            })}
            {shadowStats.best && (
              <div className="text-gray-500 mt-2 italic">
                最佳：{shadowStats.best.grade.accuracy} 分（{shadowStats.best.sentenceId}）
              </div>
            )}
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={prev}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm"
        >
          ← 上一句
        </button>

        <div className="flex-1 text-sm text-gray-500 text-center">
          {mode === "listen" ? (
            <>
              本组完成 {completedInCat}/{totalInCat} · 总进度 {totalCompleted}/150
            </>
          ) : (
            <>
              Shadow 历史 {shadowHistory.length}
              {shadowHistory.length > 0 && (
                <span className="ml-2 text-xs text-gray-400">
                  · 最近 50 条
                </span>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={next}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm"
        >
          下一句 →
        </button>
      </div>

      {/* Shadow history for current sentence (Shadow mode only) */}
      {mode === "shadow" && shadowHistoryForSentence.length > 0 && (
        <section className="border border-gray-200 rounded-2xl p-5 mb-6 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              本句 Shadow 记录 · {shadowHistoryForSentence.length} 次
            </h3>
            <button
              type="button"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm(
                    `清空本句 ${shadowHistoryForSentence.length} 条 Shadow 记录？`
                  )
                ) {
                  const newHistory = shadowHistory.filter(
                    (e) => e.sentenceId !== sentence.id
                  );
                  setShadowHistory(newHistory);
                  saveShadowHistory(newHistory);
                }
              }}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              清空
            </button>
          </div>
          <div className="space-y-2">
            {shadowHistoryForSentence.slice(0, 5).map((entry) => {
              const target = findSentenceById(entry.sentenceId);
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between text-sm bg-gray-50 rounded-xl p-3 gap-3"
                >
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-xs text-gray-500 font-mono">
                      {formatHistoryTime(entry.timestamp)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-700 font-bold">
                        {entry.grade.accuracy}
                      </span>
                      <span className="text-gray-300">/</span>
                      <span className="text-purple-700 font-bold">
                        {entry.grade.fluency}
                      </span>
                    </div>
                    {target && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            typeof window === "undefined" ||
                            !window.speechSynthesis
                          )
                            return;
                          window.speechSynthesis.cancel();
                          const u = new SpeechSynthesisUtterance(target.ja);
                          u.lang = "ja-JP";
                          u.rate = rate;
                          window.speechSynthesis.speak(u);
                        }}
                        className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                        title="重听原句 AI 朗读"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                  <div
                    className="text-xs text-gray-500 truncate min-w-0"
                    lang="ja"
                  >
                    {entry.transcript ? (
                      entry.transcript
                    ) : (
                      <span className="italic text-gray-400">(空白)</span>
                    )}
                  </div>
                </div>
              );
            })}
            {shadowHistoryForSentence.length > 5 && (
              <div className="text-xs text-gray-400 text-center pt-2">
                ... 还有 {shadowHistoryForSentence.length - 5} 条
              </div>
            )}
          </div>
        </section>
      )}

      {/* All-done celebration (Listen mode only) */}
      {mode === "listen" && allDone && (
        <div className="border border-green-200 bg-green-50 rounded-2xl p-6 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <div className="text-base font-medium text-green-800 mb-1">
            全部 150 句都听过了
          </div>
          <div className="text-sm text-green-700">
            去 <Link href="/speaking" className="underline">口语训练</Link> 试试自己说，或者回 <Link href="/today" className="underline">今日训练</Link> 看错点
          </div>
        </div>
      )}

      {!browserSupportsTts && (
        <div className="mt-4 border border-red-200 bg-red-50 rounded-2xl p-4 text-sm text-red-700 text-center">
          当前浏览器不支持 Web Speech API。请用 Chrome / Safari 打开本页面。
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400 text-center space-y-1">
        <div>🔊 Listen: Web Speech API（无需联网）</div>
        <div>
          🎤 Shadow: gpt-4o-transcribe + gpt-4o-mini（中文反馈 · 历史进
          localStorage）
        </div>
      </div>
    </main>
  );
}
