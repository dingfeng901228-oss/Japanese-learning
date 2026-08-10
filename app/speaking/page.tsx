"use client";

import { useState } from "react";
import Link from "next/link";

type Turn = { role: "user" | "assistant"; content: string };

export default function SpeakingPage() {
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      content: "こんにちは！今日はどんな一日でしたか？",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        用日语跟 AI 教练对话。结束训练后会给你反馈（Phase 1.5 启用）
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
          placeholder="用日语回复... (Enter 发送, Shift+Enter 换行)"
          rows={2}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-gray-400 disabled:bg-gray-50"
          disabled={busy}
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !input.trim()}
          className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "..." : "发送"}
        </button>
      </div>
    </main>
  );
}