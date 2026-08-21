"use client";

/**
 * Token list with revoke action.
 *
 * Per docs/0821requirements.docx §16 + §27.
 */

import { useState, useTransition } from "react";
import { Unplug } from "lucide-react";

interface TokenRow {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TokenList({ tokens: initialTokens }: { tokens: TokenRow[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const revoke = (id: string) => {
    if (!confirm("解除此 Chrome 扩展连接？已撤销的 Token 不能恢复。")) return;
    startTransition(async () => {
      setBusy(id);
      try {
        const res = await fetch("/api/extension/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenId: id }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(`解除失败：${data.error ?? res.status}`);
          return;
        }
        setTokens((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, revokedAt: new Date().toISOString() }
              : t,
          ),
        );
      } finally {
        setBusy(null);
      }
    });
  };

  const active = tokens.filter((t) => !t.revokedAt);
  const revoked = tokens.filter((t) => t.revokedAt);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-3">
        已连接的设备
        {active.length > 0 && (
          <span className="ml-2 text-sm font-normal text-green-600">
            ✓ {active.length} 个连接中
          </span>
        )}
      </h2>

      {tokens.length === 0 ? (
        <p className="text-sm text-gray-500">
          尚未连接 Chrome 扩展。生成连接码并粘贴到扩展窗口即可建立连接。
        </p>
      ) : (
        <ul className="space-y-3">
          {tokens.map((t) => (
            <li
              key={t.id}
              className={`border rounded-xl p-4 ${
                t.revokedAt
                  ? "border-gray-200 bg-gray-50 opacity-70"
                  : "border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-gray-900">
                      {t.label}
                    </span>
                    {t.revokedAt ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                        已撤销
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                        ✓ 活跃
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div>创建：{formatDate(t.createdAt)}</div>
                    <div>最后使用：{formatDate(t.lastUsedAt)}</div>
                    {t.revokedAt && (
                      <div>撤销：{formatDate(t.revokedAt)}</div>
                    )}
                  </div>
                </div>
                {!t.revokedAt && (
                  <button
                    onClick={() => revoke(t.id)}
                    disabled={busy === t.id}
                    className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <Unplug size={12} />
                    {busy === t.id ? "解除中…" : "解除连接"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {revoked.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">
          {revoked.length} 个已撤销的连接不计入上方的活跃数。
        </p>
      )}
    </section>
  );
}