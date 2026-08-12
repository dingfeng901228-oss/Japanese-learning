"use client";

import { useRef, useState } from "react";
import Link from "next/link";

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

const INITIAL_TURNS: Turn[] = [
  {
    role: "assistant",
    content: "こんにちは！今日はどんな一日でしたか？",
  },
];

// Web Speech API types (declared globally in globals.d.ts).
// Using any here because TypeScript lib.dom doesn't ship these.
type SpeechRecognitionLike = any;

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export default function SpeakingPage() {
  const [turns, setTurns] = useState<Turn[]>(INITIAL_TURNS);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [gettingFeedback, setGettingFeedback] = useState(false);

  // Phase 2: voice input via Web Speech API
  const [recognizing, setRecognizing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

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
      setError("Say at least one sentence in Japanese before getting feedback.");
      return;
    }
    setError(null);
    setGettingFeedback(true);

    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: turns }),
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
        {conversationActive
          ? "用日语跟 AI 教练对话（可以打字或🎤 语音）。结束训练后会给你反馈"
          : "对话已结束 — 下面是 AI 教练给你的反馈"}
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
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-2 text-sm text-red-600">错误: {error}</div>
      )}

      {conversationActive && (
        <>
          <div className="flex gap-2">
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
                  : "用日语回复... (Enter 发送, Shift+Enter 换行)"
              }
              rows={2}
              className={`flex-1 px-4 py-3 border rounded-lg resize-none focus:outline-none disabled:bg-gray-50 ${
                recognizing
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200 focus:border-gray-400"
              }`}
              disabled={busy}
            />
            <button
              type="button"
              onClick={recognizing ? stopRecognition : startRecognition}
              disabled={busy}
              title={
                recognizing
                  ? "停止录音"
                  : "用日语语音输入（Chrome / Safari）"
              }
              className={`px-4 py-3 rounded-lg transition-colors text-xl ${
                recognizing
                  ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {recognizing ? "⏹" : "🎤"}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "..." : "发送"}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              聊够了？获取 AI 教练反馈 →
            </span>
            <button
              type="button"
              onClick={finishConversation}
              disabled={gettingFeedback || busy}
              className="px-5 py-2 border border-gray-900 text-gray-900 rounded-lg hover:bg-gray-900 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {gettingFeedback ? "分析中..." : "结束训练，获取反馈"}
            </button>
          </div>
        </>
      )}

      {gettingFeedback && !feedback && (
        <div className="mt-6 text-center text-sm text-gray-500 py-12 border border-dashed border-gray-200 rounded-2xl">
          AI 教练正在分析你的日语...（约 5-10 秒）
        </div>
      )}

      {feedback && (
        <section className="mt-8 space-y-6">
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-bold mb-4">📝 训练反馈</h2>

            <div className="space-y-5">
              <FeedbackBlock label="整体评价">
                {feedback.overall}
              </FeedbackBlock>

              <FeedbackBlock label="自然度">
                {feedback.naturalness}
              </FeedbackBlock>

              {feedback.grammar.length > 0 && (
                <FeedbackBlock label="语法问题">
                  <ul className="list-disc pl-5 space-y-1">
                    {feedback.grammar.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </FeedbackBlock>
              )}

              {feedback.vocabulary.length > 0 && (
                <FeedbackBlock label="词汇建议">
                  <ul className="list-disc pl-5 space-y-1">
                    {feedback.vocabulary.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </FeedbackBlock>
              )}

              {feedback.strengths.length > 0 && (
                <FeedbackBlock label="做得好的">
                  <ul className="list-disc pl-5 space-y-1">
                    {feedback.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </FeedbackBlock>
              )}

              {feedback.improvements.length > 0 && (
                <FeedbackBlock label="下次重点">
                  <ul className="list-disc pl-5 space-y-1">
                    {feedback.improvements.map((im, i) => (
                      <li key={i}>{im}</li>
                    ))}
                  </ul>
                </FeedbackBlock>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <div className="text-xs text-gray-500 mb-2">来自教练</div>
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
                开始新对话
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