"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { saveMistakeToVocabAction } from "./actions";

type Turn = { role: "user" | "assistant"; content: string };

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

export default function SpeakingPage() {
  const [turns, setTurns] = useState<Turn[]>(INITIAL_TURNS);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [gettingFeedback, setGettingFeedback] = useState(false);

  // Default to Chinese. Per Frank's request (#5945), the feedback language
  // toggle is removed — always render feedback in Chinese.
  const [feedbackLanguage] = useState<FeedbackLanguage>("zh");

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
      setTurns([...next, { role: "assistant", content: data.reply }]);
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
  }

  function startRecognition() {
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
    recognition.continuous = false;
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
      setError(`语音识别错误: ${event.error || "unknown"}`);
      setRecognizing(false);
    };
    recognition.onend = () => {
      setRecognizing(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setRecognizing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRecognizing(false);
    }
  }

  function stopRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore — recognition might already have ended
      }
      recognitionRef.current = null;
    }
    setRecognizing(false);
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
      <header className="mb-6 flex items-center justify-between">
        <Link href="/today" className="text-sm text-gray-500 hover:text-gray-900">
          ← 今日训练
        </Link>
        <span className="text-sm text-gray-400">AI 口语教练</span>
      </header>

      <h1 className="text-2xl font-bold mb-2">自由对话</h1>
      <p className="text-sm text-gray-500 mb-6">
        {conversationActive ? labels.descActive : labels.descDone}
      </p>

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
              <div className="whitespace-pre-wrap">{t.content}</div>
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