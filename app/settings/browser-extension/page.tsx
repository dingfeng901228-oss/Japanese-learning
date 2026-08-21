// /settings/browser-extension — Chrome extension connection management.
//
// Per docs/0821requirements.docx §15 + §16 + §27.
//
// Server Component shell loads the user's tokens + browser-sourced count;
// client subcomponents handle the interactive parts (mint code with
// countdown, token list with revoke).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConnectCodeButton } from "./ConnectCodeButton";
import { TokenList } from "./TokenList";

export const dynamic = "force-dynamic";

export default async function BrowserExtensionSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Active + revoked tokens (both shown so user knows what to revoke).
  const { data: tokens } = await admin
    .from("extension_tokens")
    .select("id, label, created_at, last_used_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Vocab items inserted via the Chrome extension (per source column).
  const { count: browserSourcedCount } = await admin
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("source", "chrome-extension");

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <header className="mb-8">
        <Link
          href="/account"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← 返回账户
        </Link>
        <h1 className="text-3xl font-bold mt-4">浏览器扩展</h1>
        <p className="text-gray-600 mt-2">
          在任意网页选中日语，右键「收藏为生词」即可同步到 FastStudy。
        </p>
        {browserSourcedCount !== null && browserSourcedCount > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            来自浏览器阅读：<strong>{browserSourcedCount}</strong> 个
          </p>
        )}
      </header>

      <ConnectCodeButton />

      <TokenList
        tokens={
          (tokens ?? []).map((t) => ({
            id: t.id,
            label: t.label ?? "(no label)",
            createdAt: t.created_at,
            lastUsedAt: t.last_used_at,
            revokedAt: t.revoked_at,
          }))
        }
      />

      <section className="mt-8 pt-8 border-t border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          安装步骤
        </h2>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>
            从 GitHub 克隆{" "}
            <a
              href="https://github.com/dingfeng901228-oss/FastStudy-ChromePlugin"
              className="text-gray-900 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              FastStudy-ChromePlugin
            </a>{" "}
            仓库
          </li>
          <li>
            运行 <code className="bg-gray-100 px-1.5 py-0.5 rounded">npm install</code>{" "}
            + <code className="bg-gray-100 px-1.5 py-0.5 rounded">npm run build</code>
          </li>
          <li>
            打开 <code className="bg-gray-100 px-1.5 py-0.5 rounded">chrome://extensions</code>
            ，开启「开发者模式」，点击「加载已解压的扩展程序」选择{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">dist/</code>
          </li>
          <li>回到本页生成连接码，粘贴到 Chrome 扩展的连接窗口</li>
        </ol>
      </section>
    </main>
  );
}