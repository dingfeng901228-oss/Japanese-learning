"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Sentence = {
  id: string;
  ja: string;
  zh: string;
};

type Category = {
  id: string;
  label: string;
  emoji: string;
  sentences: Sentence[];
};

// 30 N5 starter sentences across 5 everyday scenes.
// Phase 1: static + inline. Future: extract to data file + add N4/N3 levels.
const CATEGORIES: Category[] = [
  {
    id: "self-intro",
    label: "自我介绍",
    emoji: "🙋",
    sentences: [
      { id: "s1-1", ja: "はじめまして。", zh: "初次见面。" },
      { id: "s1-2", ja: "私はディン・フェンと申します。", zh: "我叫丁锋。" },
      { id: "s1-3", ja: "中国から来ました。", zh: "我来自中国。" },
      { id: "s1-4", ja: "今は東京に住んでいます。", zh: "我现在住在东京。" },
      { id: "s1-5", ja: "ITエンジニアです。", zh: "我是 IT 工程师。" },
      { id: "s1-6", ja: "よろしくお願いします。", zh: "请多多关照。" },
    ],
  },
  {
    id: "restaurant",
    label: "餐厅",
    emoji: "🍱",
    sentences: [
      { id: "r1-1", ja: "注文をお願いします。", zh: "我想点餐。" },
      { id: "r1-2", ja: "ラーメンをください。", zh: "我要一份拉面。" },
      { id: "r1-3", ja: "おすすめは何ですか。", zh: "推荐什么？" },
      { id: "r1-4", ja: "辛くしないでください。", zh: "请不要加辣。" },
      { id: "r1-5", ja: "お会計をお願いします。", zh: "请结账。" },
      { id: "r1-6", ja: "現金で払います。", zh: "我付现金。" },
    ],
  },
  {
    id: "directions",
    label: "问路",
    emoji: "🗺️",
    sentences: [
      { id: "d1-1", ja: "駅はどこですか。", zh: "车站在哪里？" },
      { id: "d1-2", ja: "この道をまっすぐ行ってください。", zh: "请沿这条路直走。" },
      { id: "d1-3", ja: "右に曲がってください。", zh: "请向右转。" },
      { id: "d1-4", ja: "左に曲がってください。", zh: "请向左转。" },
      { id: "d1-5", ja: "どこまで歩けばいいですか。", zh: "需要走多远？" },
      { id: "d1-6", ja: "近くですか。", zh: "近吗？" },
    ],
  },
  {
    id: "numbers-time",
    label: "数字时间",
    emoji: "⏰",
    sentences: [
      { id: "n1-1", ja: "今、何時ですか。", zh: "现在几点？" },
      { id: "n1-2", ja: "三時です。", zh: "三点。" },
      { id: "n1-3", ja: "今日は何日ですか。", zh: "今天几号？" },
      { id: "n1-4", ja: "九月十五日です。", zh: "九月十五日。" },
      { id: "n1-5", ja: "電話番号を教えてください。", zh: "请告诉我电话号码。" },
      { id: "n1-6", ja: "百円です。", zh: "一百日元。" },
    ],
  },
  {
    id: "greetings",
    label: "寒暄",
    emoji: "👋",
    sentences: [
      { id: "g1-1", ja: "おはようございます。", zh: "早上好。" },
      { id: "g1-2", ja: "こんにちは。", zh: "你好（白天）。" },
      { id: "g1-3", ja: "こんばんは。", zh: "晚上好。" },
      { id: "g1-4", ja: "お疲れ様です。", zh: "辛苦了。" },
      { id: "g1-5", ja: "また明日。", zh: "明天见。" },
      { id: "g1-6", ja: "また会いましょう。", zh: "下次再见。" },
    ],
  },
];

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
  const [mode, setMode] = useState<Mode>("listen");

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const category = CATEGORIES[categoryIdx];
  const sentence = category.sentences[sentenceIdx];
  const totalInCat = category.sentences.length;
  const completedInCat = progress[category.id]?.size || 0;
  const totalCompleted = Object.values(progress).reduce(
    (sum, set) => sum + set.size,
    0
  );
  const allDone = totalCompleted >= 30;

  // Boot: detect browser APIs + load saved state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setBrowserSupportsTts(Boolean(window.speechSynthesis));
    setProgress(loadProgress());
    setShadowHistory(loadShadowHistory());
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
    // intentionally only depending on sentence/category idx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryIdx, sentenceIdx]);

  function stopSpeech() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
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
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(sentence.ja);
    u.lang = "ja-JP";
    u.rate = rate;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);

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
      setSentenceIdx(prevCat.sentences.length - 1);
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
          ? "听 AI 朗读：5 场景 × 6 句 = 30 句 N5 起步。点 🔊 听、慢速 / 常速切换、上一句 / 下一句。"
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

      {/* Category tabs (shared by both modes) */}
      <div
        className="flex gap-2 mb-6 overflow-x-auto pb-2"
        role="tablist"
        aria-label="场景分类"
      >
        {CATEGORIES.map((c, i) => {
          const done = progress[c.id]?.size || 0;
          const total = c.sentences.length;
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
          className="text-3xl font-bold mb-4 leading-relaxed text-center py-4 break-words"
          lang="ja"
        >
          {sentence.ja}
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
                <button
                  type="button"
                  onClick={stopShadowRecording}
                  className="px-6 py-3 rounded-lg text-base font-medium bg-red-500 text-white hover:bg-red-600 animate-pulse transition-colors"
                >
                  ⏹ 停止 ({recordingTime}s)
                </button>
              )}
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
              本组完成 {completedInCat}/{totalInCat} · 总进度 {totalCompleted}/30
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

      {/* All-done celebration (Listen mode only) */}
      {mode === "listen" && allDone && (
        <div className="border border-green-200 bg-green-50 rounded-2xl p-6 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <div className="text-base font-medium text-green-800 mb-1">
            全部 30 句都听过了
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
