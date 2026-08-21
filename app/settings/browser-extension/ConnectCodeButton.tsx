"use client";

/**
 * Connect code minter + countdown.
 *
 * Per docs/0821requirements.docx §15 + §16 + §27. User clicks
 * "生成连接码" → server mints a one-time code → display with
 * 10:00 countdown → on expiry, hide code + show regenerate CTA.
 *
 * The Chrome extension is responsible for posting the code to
 * /api/extension/redeem and storing the returned token. This page
 * only displays the code; it does not auto-fill anything.
 */

import { useEffect, useState, useTransition } from "react";
import { Copy, RefreshCw } from "lucide-react";

const TTL_SEC = 600; // 10 minutes — must match server TTL_MIN

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "active"; code: string; expiresAt: number }
  | { kind: "error"; message: string };

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ConnectCodeButton() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const [remainingMs, setRemainingMs] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (phase.kind !== "active") return;
    const tick = () => {
      const left = phase.expiresAt - Date.now();
      if (left <= 0) {
        setPhase({ kind: "idle" });
        setRemainingMs(0);
      } else {
        setRemainingMs(left);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const mintCode = () => {
    startTransition(async () => {
      setPhase({ kind: "loading" });
      try {
        const res = await fetch("/api/extension/connect", { method: "POST" });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setPhase({
            kind: "error",
            message: data.error ?? "生成连接码失败",
          });
          return;
        }
        setPhase({
          kind: "active",
          code: data.code,
          expiresAt: new Date(data.expiresAt).getTime(),
        });
      } catch (err) {
        setPhase({ kind: "error", message: String(err) });
      }
    });
  };

  const copy = async () => {
    if (phase.kind !== "active") return;
    try {
      await navigator.clipboard.writeText(phase.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user will type manually */
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-2">连接 Chrome 扩展</h2>
      <p className="text-sm text-gray-600 mb-4">
        点击生成一次性 8 位连接码，复制后粘贴到 Chrome 扩展的「连接 FastStudy」
        窗口。代码 10 分钟后失效。
      </p>

      {phase.kind === "idle" && (
        <button
          onClick={mintCode}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
        >
          生成连接码
        </button>
      )}

      {phase.kind === "loading" && (
        <button
          disabled
          className="px-4 py-2 bg-gray-300 text-white rounded-lg cursor-not-allowed text-sm font-medium"
        >
          生成中…
        </button>
      )}

      {phase.kind === "error" && (
        <div>
          <p className="text-sm text-red-600 mb-3">✗ {phase.message}</p>
          <button
            onClick={mintCode}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            重试
          </button>
        </div>
      )}

      {phase.kind === "active" && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <code className="flex-1 text-2xl font-mono font-bold tracking-widest text-center px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg select-all">
              {phase.code}
            </code>
            <button
              onClick={copy}
              className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium flex items-center gap-1"
              title="复制"
            >
              <Copy size={14} />
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span
              className={`tabular-nums font-medium ${
                remainingMs < 60_000 ? "text-red-600" : "text-gray-700"
              }`}
            >
              剩余时间 {formatRemaining(remainingMs)}
            </span>
            <button
              onClick={mintCode}
              className="text-xs text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw size={11} />
              重新生成
            </button>
          </div>
        </div>
      )}
    </section>
  );
}