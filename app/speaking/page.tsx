"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { saveMistakeToVocabAction } from "./actions";
import { useSessionTimer, formatDuration } from "@/lib/today-stats";
import {
  SPEAKING_TOPICS,
  DEFAULT_AI_PROMPT,
  type SpeakingTopic,
} from "@/lib/speaking-topics";

// Phase 7+ (#6280): persist the conversation across reloads so the
// user doesn't lose their context every time they come back. Single
// per-browser key — if a different user signs in on the same machine
// they'd see the previous conversation; "开始新对话" clears it.
const TURNS_STORAGE_KEY = "japaneseLearning.speakingTurns";

// Per Frank #6342: each assistant turn carries optional jaHtml (with
// <ruby> furigana annotations) and translation (Chinese) so the
// learner can read the Japanese with kanji readings + reveal the
// Chinese on demand.
type Turn = {
  role: "user" | "assistant";
  content: string;
  translation?: string;
  jaHtml?: string;
};

type Feedback = {
  overall: string;
  grammar: string[];
  vocabulary: string[];
  naturalness: string;
  strengths: string[];
  improvements: string[];
  encouragement: string;
};

type FeedbackLanguage = "zh" | "en";

const INITIAL_TURNS: Turn[] = [
  {
    role: "assistant",
    content: "こんにちは！今日はどんな一日でしたか？",
    jaHtml:
      'こんにちは！<ruby>今日<rt>きょう</rt></ruby>はどんな<ruby>一日<rt>いちにち</rt></ruby>でしたか？',
    translation: "你好！今天过得怎么样？",
  },
];

// Web Speech API types (declared globally in globals.d.ts).
type SpeechRecognitionLike = any;

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

const FEEDBACK_LABELS: Record<FeedbackLanguage, Record<string, string>> = {
  zh: {
    heading: "📝 训练反馈",
    overall: "整体评价",
    naturalness: "自然度",
    grammar: "语法问题",
    vocabulary: "词汇建议",
    strengths: "做得好的",
    improvements: "下次重点",
    fromCoach: "来自教练",
    descActive: "用日语跟 AI 教练对话（可以打字或 🎤 语音）。结束后选语言、点下方按钮获取反馈",
    descDone: "对话已结束 — 下面是 AI 教练给你的反馈",
    finishCta: "结束训练，获取反馈",
    analyzing: "分析中...",
    startNew: "开始新对话",
    speakHint: "聊够了？获取 AI 教练反馈 →",
    pickLangHint: "选完语言后点按钮获取反馈 →",
    emptyError: "Say at least one sentence in Japanese before getting feedback.",
  },
  en: {
    heading: "📝 Session Feedback",
    overall: "Overall",
    naturalness: "Naturalness",
    grammar: "Grammar",
    vocabulary: "Vocabulary",
    strengths: "Strengths",
    improvements: "Areas to Improve",
    fromCoach: "From Your Tutor",
    descActive:
      "Chat with the AI tutor in Japanese (type or 🎤 voice). Pick a feedback language, then click below to end the session.",
    descDone: "Session ended — here's your tutor's feedback",
    finishCta: "End Session & Get Feedback",
    analyzing: "Analyzing...",
    startNew: "Start New Conversation",
    speakHint: "Done talking? Get your tutor's feedback →",
    pickLangHint: "Pick a language above, then click to get feedback →",
    emptyError: "Say at least one sentence in Japanese before getting feedback.",
  },
};

// STORAGE_KEY removed along with the feedback language toggle (see #5945).

// Per Frank #6342: GPT generates jaHtml with <ruby>/<rt>. Sanitize as
// defense in depth — should never be needed if GPT follows the prompt,
// but cheap insurance against prompt drift. Keeps text content intact.
function sanitizeRubyHtml(html: string): string {
  return html.replace(/<(?!\/?(?:ruby|rt)\b)[^>]*>/gi, "");
}

export default function SpeakingPage() {
  const [turns, setTurns] = useState<Turn[]>(INITIAL_TURNS);
  // Per Frank #6342: which assistant turn currently has its Chinese
  // translation visible. null = none. Default hidden so the learner
  // tries to read the Japanese first.
  const [showTranslationIdx, setShowTranslationIdx] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [gettingFeedback, setGettingFeedback] = useState(false);

  // Default to Chinese. Per Frank's request (#5945), the feedback language
  // toggle is removed — always render feedback in Chinese.
  const [feedbackLanguage] = useState<FeedbackLanguage>("zh");

  // Phase 7+ (#6330): currently-selected speaking topic (null = 自由对话).
  // When set, the conversation's first AI message is the topic's
  // aiPrompt instead of the generic greeting. "换个话题" clears this.
  const [selectedTopic, setSelectedTopic] = useState<SpeakingTopic | null>(null);

  // Phase 1.5+ real-time session timer (per Frank #6175). Hook re-runs
  // when the user navigates between Speaking and other pages, so each
  // session's time gets attributed to "speaking" specifically.
  const { elapsed: speakingElapsed } = useSessionTimer("speaking");

  // Phase 4: save each generated feedback's mistakes to localStorage so
  // /today can show "最近弱点" as a live history instead of hardcoded text.
  useEffect(() => {
    if (!feedback) return;
    if (typeof window === "undefined") return;
    const KEY = "japaneseLearning.mistakeHistory";
    const history = JSON.parse(
      window.localStorage.getItem(KEY) || "[]"
    ) as Array<{
      id: string;
      timestamp: number;
      language: FeedbackLanguage;
      grammar: string[];
      vocabulary: string[];
    }>;
    history.push({
      id: Date.now().toString(),
      timestamp: Date.now(),
      language: feedbackLanguage,
      grammar: feedback.grammar,
      vocabulary: feedback.vocabulary,
    });
    window.localStorage.setItem(KEY, JSON.stringify(history));
  }, [feedback, feedbackLanguage]);

  // Phase 2: voice input via Web Speech API
  const [recognizing, setRecognizing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Mirror of `recognizing` kept in a ref so the onend closure (which
  // captures stale state by default) can see the latest value when deciding
  // whether to auto-restart (continuous: true) or settle to idle.
  const recognizingRef = useRef(false);

  // Phase 7 (#6280): real-time waveform during voice input. Same
  // pattern as the shadow mode recorder: AnalyserNode + raw time-domain
  // PCM samples + SVG path mutated via ref (no React re-render @ 60fps).
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformPathRef = useRef<SVGPathElement | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceFrameRef = useRef<number | null>(null);

  // Phase 7 (#6280): persist conversation turns across reloads.
  const turnsStorageKey = TURNS_STORAGE_KEY;

  // Phase 7 (#6280): load saved conversation on mount, save on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(turnsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Turn[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTurns(parsed);
        }
      }
    } catch {
      // ignore corrupt storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(turnsStorageKey, JSON.stringify(turns));
    } catch {
      // storage quota — silently ignore
    }
  }, [turns, turnsStorageKey]);

  // Phase 6 MVP: TTS via Web Speech API — track which AI message is
  // currently being spoken so the button can show a stop state.
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  // Phase 1 enhancement: per-vocab-suggestion save state. `savingIdx` is
  // the index currently in flight (button shows "..." + disabled);
  // `savedSet` collects indices already saved this session (button shows
  // "✓ 已保存" + disabled). Resets when "开始新对话" runs.
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());

  // Phase 1 enhancement follow-up: grammar items get their own
  // saving/saved sets so vocab and grammar indices don't collide.
  const [savingGrammarIdx, setSavingGrammarIdx] = useState<number | null>(
    null
  );
  const [savedGrammarSet, setSavedGrammarSet] = useState<Set<number>>(
    new Set()
  );

  async function handleSaveMistake(
    idx: number,
    word: string,
    type: "word" | "phrase" | "grammar" | "sentence" = "word"
  ) {
    if (savedSet.has(idx) || savingIdx !== null) return;
    setSavingIdx(idx);
    try {
      const fd = new FormData();
      fd.set("word", word);
      fd.set("type", type);
      await saveMistakeToVocabAction(fd);
      setSavedSet((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
    } catch (err) {
      console.error("handleSaveMistake failed:", err);
    } finally {
      setSavingIdx(null);
    }
  }

  async function handleSaveGrammar(idx: number, grammar: string) {
    if (savedGrammarSet.has(idx) || savingGrammarIdx !== null) return;
    setSavingGrammarIdx(idx);
    try {
      const fd = new FormData();
      fd.set("word", grammar);
      fd.set("type", "grammar");
      await saveMistakeToVocabAction(fd);
      setSavedGrammarSet((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
    } catch (err) {
      console.error("handleSaveGrammar failed:", err);
    } finally {
      setSavingGrammarIdx(null);
    }
  }

  const labels = FEEDBACK_LABELS[feedbackLanguage];

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);

    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    setBusy(true);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({} as { error?: string }));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as { reply: string };
      setTurns([
        ...next,
        {
          role: "assistant",
          content: data.reply,
          translation: data.translation,
          jaHtml: data.jaHtml,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finishConversation() {
    const userTurns = turns.filter((t) => t.role === "user");
    if (userTurns.length === 0) {
      setError(labels.emptyError);
      return;
    }
    setError(null);
    setGettingFeedback(true);

    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: turns, language: feedbackLanguage }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({} as { error?: string }));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as { feedback: Feedback };
      setFeedback(data.feedback);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGettingFeedback(false);
    }
  }

  function startNewConversation() {
    setTurns(INITIAL_TURNS);
    setInput("");
    setError(null);
    setFeedback(null);
    setSavedSet(new Set());
    setSavingIdx(null);
    setSavedGrammarSet(new Set());
    setSavingGrammarIdx(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(turnsStorageKey);
    }
  }

  // Phase 7+ (#6330): start a conversation on a specific topic. Resets
  // the conversation history and frames the AI's first message with
  // the topic's scenario (restaurant, directions, etc.).
  function startTopic(topic: SpeakingTopic) {
    setSelectedTopic(topic);
    setTurns([{ role: "assistant", content: topic.aiPrompt }]);
    setInput("");
    setError(null);
    setFeedback(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(turnsStorageKey);
    }
  }

  // Phase 7+ (#6330): clear the current topic and revert to the default
  // "自由对话" greeting.
  function clearTopic() {
    setSelectedTopic(null);
    startNewConversation();
  }

  async function startRecognition() {
    if (recognizing) return;
    const recognition = getSpeechRecognition();
    if (!recognition) {
      setError(
        "当前浏览器不支持语音识别。请用 Chrome 或 Safari（或手动输入）。"
      );
      return;
    }
    setError(null);
    recognition.lang = "ja-JP";
    // Phase 7 (#6280): keep recording across pauses — the user used to
    // get cut off if they paused too long (continuous: false). We also
    // auto-restart on `onend` (see below) so a stray end doesn't drop
    // the session.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onerror = (event: any) => {
      const err = event.error || "unknown";
      // "no-speech" / "aborted" are normal lifecycle events when the
      // user toggles off or the tab loses focus — don't surface them as
      // errors.
      if (err !== "no-speech" && err !== "aborted") {
        setError(`语音识别错误: ${err}`);
      }
    };
    recognition.onend = () => {
      stopVoiceMeter();
      // User still wants to record (hasn't pressed stop or re-record)?
      // Auto-restart so a stray `onend` (e.g. browser idle timeout)
      // doesn't drop the session mid-thought.
      if (recognizingRef.current) {
        try {
          recognition.start();
        } catch {
          // already running — fine
        }
        return;
      }
      setRecognizing(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setRecognizing(true);
      recognizingRef.current = true;

      // Phase 7 (#6280): real-time waveform via the mic stream.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        voiceStreamRef.current = stream;
        startVoiceMeter(stream);
      } catch {
        // Mic permission denied — recognition still works, no waveform.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRecognizing(false);
      recognizingRef.current = false;
    }
  }

  // Phase 7 (#6280): cancel current recognition + clear input +
  // re-start fresh. Used by the 重录 button.
  function reRecord() {
    setInput("");
    if (recognizing) {
      // Force-stop, then startRecognition below will spin up again.
      setRecognizing(false);
      recognizingRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // already stopped
        }
      }
    }
    stopVoiceMeter();
    // Defer slightly so onend has a chance to clean up before we
    // restart.
    setTimeout(() => {
      startRecognition();
    }, 150);
  }

  // Phase 7 (#6280): Web Audio volume meter (time-domain waveform).
  // Reuses the same pattern as the shadow mode recorder: AnalyserNode
  // + getByteTimeDomainData + SVG path mutated via ref.
  function startVoiceMeter(stream: MediaStream) {
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
        analyserRef.current.getByteTimeDomainData(data);
        const w = 220;
        const h = 24;
        const mid = h / 2;
        const sliceWidth = w / data.length;
        let path = "";
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0; // 0–2, 1.0 = silence
          const y = mid - (v - 1) * mid;
          const x = i * sliceWidth;
          if (i === 0) path += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
          else path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
        }
        if (waveformPathRef.current) {
          waveformPathRef.current.setAttribute("d", path);
        }
        voiceFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.error("voice meter failed:", e);
    }
  }

  function stopVoiceMeter() {
    if (voiceFrameRef.current) {
      cancelAnimationFrame(voiceFrameRef.current);
      voiceFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((t) => t.stop());
      voiceStreamRef.current = null;
    }
    if (waveformPathRef.current) {
      waveformPathRef.current.setAttribute("d", "");
    }
  }

  function stopRecognition() {
    setRecognizing(false);
    recognizingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore — recognition might already have ended
      }
      recognitionRef.current = null;
    }
    stopVoiceMeter();
  }

  // Phase 6 MVP: speak an AI message aloud via Web Speech API.
  // Click again to stop. Slightly slower rate for learning.
  function speakJapanese(text: string, idx: number) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setError("当前浏览器不支持语音合成。请用 Chrome 或 Safari。");
      return;
    }
    // Toggle: same button while playing stops the current speech
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    // Cancel any in-flight utterance before starting a new one
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingIdx(idx);
  }

  const conversationActive = !feedback && !gettingFeedback;

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
            🕐 {formatDuration(speakingElapsed)}
          </span>
          <span className="text-sm text-gray-400">AI 口语教练</span>
        </div>
      </header>

      <h1 className="text-2xl font-bold mb-2">
        {selectedTopic ? selectedTopic.title : "自由对话"}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {conversationActive ? labels.descActive : labels.descDone}
      </p>

      {/* Phase 7+ (#6330): topic picker. When no topic is selected, show
         a grid of 10 cards the user can pick to start a themed
         conversation. When a topic is selected, collapse to a small pill
         + "换个话题" toggle. */}
      <div className="mb-6">
        {selectedTopic ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-soft border border-line">
            <span className="text-lg flex-shrink-0">
              {selectedTopic.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">
                {selectedTopic.title}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {selectedTopic.description}
              </p>
            </div>
            <button
              type="button"
              onClick={clearTopic}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              换个话题
            </button>
          </div>
        ) : (
          <div>
            <div className="text-xs text-gray-500 mb-2">
              💡 选个话题开始，或直接自由对话
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedTopic(null);
                  startNewConversation();
                }}
                className="text-left px-3 py-2.5 rounded-lg border-2 border-gray-900 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                <div className="text-lg mb-0.5">💬</div>
                <div className="text-sm font-medium">自由对话</div>
                <div className="text-xs opacity-80 mt-0.5">
                  不选话题，直接聊
                </div>
              </button>
              {SPEAKING_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => startTopic(topic)}
                  title={topic.description}
                  className="text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-lg mb-0.5">{topic.emoji}</div>
                  <div className="text-sm font-medium text-ink truncate">
                    {topic.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {topic.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
        {turns.map((t, i) => (
          <div
            key={i}
            className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                t.role === "user"
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-200"
              }`}
            >
              <div
                className={`text-xs mb-1 ${t.role === "user" ? "text-gray-300" : "text-gray-400"}`}
              >
                {t.role === "user" ? "You" : "AI 教练"}
              </div>
              <div className="whitespace-pre-wrap">
                {/* Per Frank #6342: render ruby HTML if present (kanji
                    annotated with furigana), otherwise fall back to
                    plain content. Safe — sanitizeRubyHtml strips any
                    tags that aren't <ruby>/<rt>. */}
                {t.jaHtml ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRubyHtml(t.jaHtml),
                    }}
                  />
                ) : (
                  t.content
                )}
              </div>
              {t.role === "assistant" && t.translation && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowTranslationIdx(
                        showTranslationIdx === i ? null : i
                      )
                    }
                    aria-pressed={showTranslationIdx === i}
                    className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    {showTranslationIdx === i
                      ? "🌐 隐藏翻译"
                      : "🌐 显示翻译"}
                  </button>
                  {showTranslationIdx === i && (
                    <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2 leading-relaxed">
                      {t.translation}
                    </div>
                  )}
                </div>
              )}
              {t.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => speakJapanese(t.content, i)}
                  disabled={recognizing}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 disabled:opacity-40"
                >
                  {speakingIdx === i ? (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      ⏹ 停止
                    </span>
                  ) : (
                    <>🔊 听 AI 示范</>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-2 text-sm text-red-600">错误: {error}</div>
      )}

      {conversationActive && (
        <div className="space-y-3">
          {/* Row 1: textarea */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              recognizing
                ? "🎤 正在听...（请说日语）"
                : "用日语回复... (Shift+Enter 换行)"
            }
            rows={1}
            className={`w-full px-4 py-3 border rounded-lg resize-none focus:outline-none disabled:bg-gray-50 ${
              recognizing
                ? "border-red-300 bg-red-50"
                : "border-gray-200 focus:border-gray-400"
            }`}
            disabled={busy}
          />

          {/* Phase 7 (#6280): real-time raw waveform during voice input.
             Only visible while recording. SVG path is mutated directly via
             ref (see startVoiceMeter) so we don't re-render React @ 60fps. */}
          {recognizing && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
              <span className="text-xs text-red-600 font-medium flex-shrink-0">
                🎙️ 正在听
              </span>
              <svg
                width={220}
                height={24}
                viewBox="0 0 220 24"
                className="block flex-1"
                aria-hidden="true"
              >
                <path
                  ref={waveformPathRef}
                  d=""
                  stroke="rgb(220, 38, 38)"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}

          {/* Row 2: voice + keyboard hint + send */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={recognizing ? stopRecognition : startRecognition}
              disabled={busy}
              title={
                recognizing
                  ? "停止录音"
                  : "用日语语音输入（Chrome / Safari）"
              }
              className={`flex-shrink-0 px-4 py-2.5 rounded-lg transition-colors text-xl ${
                recognizing
                  ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {recognizing ? "⏹" : "🎤"}
            </button>
            {recognizing && (
              <button
                type="button"
                onClick={reRecord}
                title="清空 input + 立即重新开始识别"
                className="flex-shrink-0 px-3 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                🔁 重录
              </button>
            )}
            <span className="flex-1 text-xs text-gray-400 text-center whitespace-nowrap">
              Enter 发送 · Shift+Enter 换行
            </span>
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="flex-shrink-0 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {busy ? "..." : "发送"}
            </button>
          </div>

          {/* Separator */}
          <div className="pt-3 border-t border-gray-100" />

          {/* Row 3: feedback language — removed per Frank's request (#5945) */}

          {/* Row 4: finish button (full-width on mobile) */}
          <button
            type="button"
            onClick={finishConversation}
            disabled={gettingFeedback || busy}
            className="w-full px-5 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
          >
            {gettingFeedback ? labels.analyzing : labels.finishCta}
          </button>
        </div>
      )}

      {gettingFeedback && !feedback && (
        <div className="mt-6 text-center text-sm text-gray-500 py-12 border border-dashed border-gray-200 rounded-2xl">
          {labels.analyzing}
        </div>
      )}

      {feedback && (
        <section className="mt-8 space-y-6">
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-bold mb-4">{labels.heading}</h2>

            <div className="space-y-5">
              <FeedbackBlock label={labels.overall}>
                {feedback.overall}
              </FeedbackBlock>

              <FeedbackBlock label={labels.naturalness}>
                {feedback.naturalness}
              </FeedbackBlock>

              {feedback.grammar.length > 0 && (
                <FeedbackBlock label={labels.grammar}>
                  <ul className="space-y-2">
                    {feedback.grammar.map((g, i) => {
                      const saved = savedGrammarSet.has(i);
                      const saving = savingGrammarIdx === i;
                      return (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="flex-1 text-sm text-gray-800">
                            {g}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSaveGrammar(i, g)}
                            disabled={saved || saving}
                            aria-label={
                              saved
                                ? `已保存语法 ${g}`
                                : `保存语法到词汇本`
                            }
                            className={`flex-shrink-0 px-3 py-1 text-xs rounded-lg transition-colors disabled:cursor-not-allowed ${
                              saved
                                ? "bg-green-50 text-green-700"
                                : saving
                                  ? "bg-gray-100 text-gray-500"
                                  : "bg-gray-900 text-white hover:bg-gray-800"
                            }`}
                          >
                            {saved
                              ? "✓ 已保存"
                              : saving
                                ? "保存中…"
                                : "📥 保存"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </FeedbackBlock>
              )}

              {feedback.vocabulary.length > 0 && (
                <FeedbackBlock label={labels.vocabulary}>
                  <ul className="space-y-2">
                    {feedback.vocabulary.map((v, i) => {
                      const saved = savedSet.has(i);
                      const saving = savingIdx === i;
                      return (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="flex-1 text-sm text-gray-800">
                            {v}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSaveMistake(i, v)}
                            disabled={saved || saving}
                            aria-label={
                              saved ? "已保存到词汇本" : "保存到词汇本"
                            }
                            className={`flex-shrink-0 px-3 py-1 text-xs rounded-lg transition-colors disabled:cursor-not-allowed ${
                              saved
                                ? "bg-green-50 text-green-700"
                                : saving
                                  ? "bg-gray-100 text-gray-500"
                                  : "bg-gray-900 text-white hover:bg-gray-800"
                            }`}
                          >
                            {saved
                              ? "✓ 已保存"
                              : saving
                                ? "保存中…"
                                : "📥 保存"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs text-gray-400 mt-3">
                    保存后 AI 自动补全读音/中文/JLPT/词性，生成例句，加入今日复习队列。
                  </p>
                </FeedbackBlock>
              )}

              {feedback.strengths.length > 0 && (
                <FeedbackBlock label={labels.strengths}>
                  <ul className="list-disc pl-5 space-y-1">
                    {feedback.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </FeedbackBlock>
              )}

              {feedback.improvements.length > 0 && (
                <FeedbackBlock label={labels.improvements}>
                  <ul className="list-disc pl-5 space-y-1">
                    {feedback.improvements.map((im, i) => (
                      <li key={i}>{im}</li>
                    ))}
                  </ul>
                </FeedbackBlock>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <div className="text-xs text-gray-500 mb-2">
                  {labels.fromCoach}
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {feedback.encouragement}
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={startNewConversation}
                className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                {labels.startNew}
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function FeedbackBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className="text-sm whitespace-pre-wrap">{children}</div>
    </div>
  );
}