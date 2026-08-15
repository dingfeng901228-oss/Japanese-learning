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
import {
  type Diff,
  type GradeResponse,
  type Issue,
  ISSUE_TYPE_LABELS,
  SEVERITY_LABELS,
} from "@/lib/grade-types";
import { Tooltip } from "@/components/ui/tooltip";

const PROGRESS_KEY = "japanese:listen-progress";
const SHADOW_HISTORY_KEY = "japanese:shadow-history";

type ShadowGrade = {
  accuracy: number;
  fluency: number;
  feedback: string;
  suggestions: string[];
  encouragement: string;
};

// P1.B — server-returned per-token diff + structured issue list. Both
// optional so old shadow-history entries (Phase 1 base / Phase 2) keep
// loading; client falls back to computeWordDiff() when missing.
type ShadowHistoryEntry = {
  id: string;
  sentenceId: string;
  categoryId: string;
  timestamp: number;
  transcript: string;
  grade: ShadowGrade;
  diff?: Diff;
  issues?: Issue[];
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

// P1.B — token shape used by both the server and client diff paths. The
// `status` field is set by the server; the client fallback (below)
// derives it from a transcript substring check.
type DiffRenderToken = {
  word: string;
  isSeparator: boolean;
  status?: "matched" | "mismatched";
  target?: string;
  transcript?: string;
  transcriptForm?: string;
};

// Phase 1 enhancement (fallback only since P1.B): compare target sentence
// against transcript at the word level. Returns the tokens (for rendering)
// and the matched/missed sets (for stats). When the server returns a
// structured diff it is used directly and this helper is skipped.
function computeWordDiff(
  target: string,
  transcript: string
): {
  tokens: DiffRenderToken[];
  matched: string[];
  missed: string[];
  source: "client";
} {
  const tokens = tokenizeWithSeparators(target);
  const transcriptWords = new Set(
    transcript.split(/[、。「」!?\s]+/).filter(Boolean)
  );
  const matched: string[] = [];
  const missed: string[] = [];
  const renderTokens: DiffRenderToken[] = [];
  for (const tok of tokens) {
    if (tok.isSeparator) {
      renderTokens.push({ word: tok.word, isSeparator: true });
      continue;
    }
    if (transcriptWords.has(tok.word) || transcript.includes(tok.word)) {
      matched.push(tok.word);
      renderTokens.push({
        word: tok.word,
        isSeparator: false,
        status: "matched",
      });
    } else {
      missed.push(tok.word);
      renderTokens.push({
        word: tok.word,
        isSeparator: false,
        status: "mismatched",
      });
    }
  }
  return { tokens: renderTokens, matched, missed, source: "client" };
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
  const [mode, setMode] = useState<Mode>("listen");

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
  // P1.A — client-side notices (auto-stop notice + 4MB warning). No
  // toast library installed in this project, so we surface these as a
  // single inline notice that clears when the next recording starts.
  const [clientWarning, setClientWarning] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakCancelRef = useRef(false);

  // P1.A — client-side recording safety caps.
  // 30s cap: average N3+ sentences + buffer; longer recordings blow past
  // the 4MB Vercel Hobby body limit and trigger 413s. Auto-stop keeps
  // the upload path clean.
  const MAX_RECORDING_SEC = 30;
  // 4MB warning: Vercel Hobby serverless function body limit is ~4.5MB;
  // a single 4MB+ audio upload is rejected at the edge. Warn before
  // POST so the user knows to re-record shorter chunks.
  const MAX_BLOB_BYTES = 4 * 1024 * 1024;

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

  // P1.B — prefer server-returned `diff` (structured per-token alignment
  // with kana-form hints); fall back to client `computeWordDiff()` for
  // older shadow-history entries that don't carry one. The two shapes
  // are unified into a single `wordDiff` shape so the render section
  // below doesn't branch on source.
  //
  // `tokenIssues` is an index → issues[] map for hover tooltips.
  const currentShadowEntry =
    mode === "shadow" && shadowPhase === "result" && transcript
      ? shadowHistory.find(
          (e) => e.sentenceId === sentence.id && e.transcript === transcript
        ) ?? null
      : null;
  const serverDiff = currentShadowEntry?.diff;
  const serverIssues = currentShadowEntry?.issues;
  const tokenIssues: Issue[] =
    serverIssues && serverIssues.length > 0 ? serverIssues : [];
  const wordDiff =
    mode === "shadow" && shadowPhase === "result" && transcript
      ? serverDiff && serverDiff.tokens.length > 0
        ? {
            // server shape — tokens already aligned, no need to recompute.
            // Each token has an explicit `status` from the model.
            tokens: serverDiff.tokens.map((t) => ({
              word: t.text,
              isSeparator: false,
              status: t.status as "matched" | "mismatched",
              target: t.target,
              transcript: t.transcript,
              transcriptForm: t.transcriptForm,
            })),
            matched: serverDiff.tokens
              .filter((t) => t.status === "matched")
              .map((t) => t.text),
            missed: serverDiff.tokens
              .filter((t) => t.status === "mismatched")
              .map((t) => t.text),
            source: "server" as const,
          }
        : computeWordDiff(sentence.ja, transcript)
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
    setClientWarning(null); // P1.A — clear stale notice on sentence change
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
    setClientWarning(null);
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
    setClientWarning(null); // P1.A — clear stale notice on new recording

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

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        // P1.A — 4MB Vercel body limit awareness. Warn (don't block) so
        // the user understands why the server may 413.
        if (blob.size > MAX_BLOB_BYTES) {
          setClientWarning(
            `录音 ${(blob.size / 1024 / 1024).toFixed(1)}MB，超过 4MB。Vercel 免费层 body 限制 ~4MB，建议分段重录或缩短到 ${MAX_RECORDING_SEC}s 以内。`
          );
        }
        await runShadowPipeline(blob);
      };

      recordingStartRef.current = Date.now();
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        if (!recordingStartRef.current) return;
        const elapsed = Math.floor(
          (Date.now() - recordingStartRef.current) / 1000
        );
        setRecordingTime(elapsed);
        // P1.A — auto-stop at MAX_RECORDING_SEC. Calling stop() here is
        // safe — recorder.onstop fires once and runs the pipeline.
        if (
          elapsed >= MAX_RECORDING_SEC &&
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          setClientWarning(
            `录音到 ${MAX_RECORDING_SEC}s 自动停止。正在转写 + 评分…`
          );
          mediaRecorderRef.current.stop();
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
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
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
      // P1.B — full GradeResponse (grade + optional diff + optional issues).
      // We capture `diff` and `issues` so the next render can use the
      // server-aligned tokens instead of the client substring fallback.
      const gData = (await gRes.json()) as GradeResponse;
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
        diff: gData.diff,
        issues: gData.issues,
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
    setClientWarning(null);
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
      const gData = (await gRes.json()) as GradeResponse;
      setGrade(gData.grade);
      // Update history entry (if id matches) so the corrected transcript +
      // grade + fresh diff/issues are persisted in localStorage history.
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
          diff: gData.diff,
          issues: gData.issues,
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
        <Link
          href="/speaking"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          口语训练 →
        </Link>
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
          className="text-3xl font-bold mb-4 leading-loose text-center py-4 break-words"
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

        <div className="text-base text-gray-600 text-center mb-6">
          {sentence.zh}
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
                  {/* Visual waveform indicator (7 staggered bars). 
                     Not real audio level — just visual feedback that recording is alive. */}
                  <div
                    className="flex items-end gap-1 h-8"
                    aria-hidden="true"
                  >
                    {[30, 55, 40, 75, 50, 65, 35].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-red-500 rounded-full animate-pulse"
                        style={{
                          height: `${h}%`,
                          animationDelay: `${i * 0.12}s`,
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={stopShadowRecording}
                    className="px-6 py-3 rounded-lg text-base font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    ⏹ 停止录音
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

            {clientWarning && (
              <div className="mt-3 text-sm text-amber-800 text-center bg-amber-50 border border-amber-200 rounded-lg p-3">
                💡 {clientWarning}
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

            {/* P1.B — 逐字对照 (target vs transcript). When the server returned
                a structured `diff`, each token has an explicit `status` and a
                `transcriptForm` for kanji → kana mismatches. Otherwise we
                use the Phase 1 client fallback (substring match). */}
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
                    if (tok.isSeparator) {
                      return (
                        <span key={i} className="text-gray-500">
                          {tok.word}
                        </span>
                      );
                    }
                    const status =
                      tok.status ??
                      (wordDiff.matched.includes(tok.word)
                        ? "matched"
                        : "mismatched");
                    const baseCls =
                      status === "matched"
                        ? "text-green-700"
                        : "text-red-600 line-through";
                    // For kanji-reading mismatches the server may include
                    // a kana transcriptForm — render it under the kanji
                    // and show a Tooltip with the full hint on hover/focus.
                    // (Replaces the inline `[かな]` annotation + native
                    // HTML `title` attribute — both had poor UX.)
                    if (
                      status === "mismatched" &&
                      tok.transcriptForm &&
                      tok.target &&
                      tok.transcriptForm !== tok.target
                    ) {
                      return (
                        <Tooltip
                          key={i}
                          side="top"
                          content={`读了 ${tok.transcriptForm}（应为 ${tok.target}）`}
                        >
                          <span className={`${baseCls} mr-0.5`}>
                            {tok.word}
                            <span className="ml-0.5 text-[0.7em] text-red-400 not-italic font-mono">
                              [{tok.transcriptForm}]
                            </span>
                          </span>
                        </Tooltip>
                      );
                    }
                    // Mismatched token without a kana transcriptForm —
                    // wrap in a Tooltip so the user can hover/focus to
                    // see the structured-issue hint if one is attached.
                    if (status === "mismatched") {
                      const issue = tokenIssues.find(
                        (iss) => iss.tokenIndex === i
                      );
                      const hint = issue
                        ? `${ISSUE_TYPE_LABELS[issue.type]} · ${SEVERITY_LABELS[issue.severity]}${issue.expected && issue.heard ? ` · 听「${issue.heard}」应为「${issue.expected}」` : ""}${issue.hint ? ` · ${issue.hint}` : ""}`
                        : "听错了";
                      return (
                        <Tooltip key={i} side="top" content={hint}>
                          <span className={`${baseCls} mr-0.5`}>
                            {tok.word}
                          </span>
                        </Tooltip>
                      );
                    }
                    return (
                      <span key={i} className={baseCls}>
                        {tok.word}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* P1.B — compact issues list (current shadow only). When the
                server returns structured issues, surface the top ones with
                type / severity / hint. Falls back to nothing for old
                shadow-history entries that lack `issues`. */}
            {tokenIssues.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
                  结构化错误 · {tokenIssues.length} 条
                </div>
                <ul className="text-sm space-y-1.5">
                  {tokenIssues.map((iss, i) => (
                    <li
                      key={`${iss.tokenIndex}-${iss.type}-${i}`}
                      className="bg-red-50 border border-red-200 rounded-lg p-2.5"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide ${
                            iss.severity === "critical"
                              ? "bg-red-600 text-white"
                              : iss.severity === "major"
                                ? "bg-red-200 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {SEVERITY_LABELS[iss.severity]}
                        </span>
                        <span className="text-xs font-medium text-red-800">
                          {ISSUE_TYPE_LABELS[iss.type]}
                        </span>
                        {iss.expected && iss.heard && (
                          <span className="text-xs text-gray-600 font-mono">
                            听「{iss.heard}」应为「{iss.expected}」
                          </span>
                        )}
                      </div>
                      {iss.hint && (
                        <div className="text-xs text-gray-700 leading-relaxed">
                          💡 {iss.hint}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
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
