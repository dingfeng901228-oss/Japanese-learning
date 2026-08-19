// Account page — per Frank #6269. Shows everything the auth layer
// hands us (email, provider, Google account id, created_at,
// last_sign_in_at) plus a tiny learning-stats strip from Supabase.
//
// Server component (consistent with the rest of the app); the navbar
// already guards the route via middleware's PROTECTED_PREFIXES
// (lib/supabase/middleware.ts), so we render unconditionally here.

import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/auth/actions";

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function providerLabel(p: string | undefined): string {
  if (p === "google") return "Google";
  if (p === "email") return "邮箱 / 密码";
  if (p === "github") return "GitHub";
  return p ?? "—";
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Middleware should have caught this, but if it ever doesn't, return
    // a quiet message rather than crash the page.
    return (
      <main className="max-w-[800px] mx-auto px-6 py-10">
        <p className="text-sm text-gray-500">未登录。</p>
      </main>
    );
  }

  // Learning stats (best-effort; if the queries fail the page still
  // renders with 0s, which is fine — the account info is the main
  // content).
  let wordCount = 0;
  let reviewCount = 0;
  try {
    const [w, r] = await Promise.all([
      supabase
        .from("vocabulary_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("vocabulary_reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
    wordCount = w.count ?? 0;
    reviewCount = r.count ?? 0;
  } catch {
    // ignore — show 0s
  }

  const email = user.email ?? "";
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;
  const provider = (user.app_metadata as { provider?: string } | null)
    ?.provider;
  const createdAt = user.created_at;
  const lastSignInAt = user.last_sign_in_at;
  const userId = user.id;
  const emailConfirmed = user.email_confirmed_at ? "是" : "否";

  const initial = ((displayName ?? email) || "?").trim()[0]?.toUpperCase() ?? "?";

  return (
    <main className="max-w-[800px] mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Account</h1>
        <p className="text-sm text-gray-500 mt-1">账号信息</p>
      </header>

      {/* Profile */}
      <section className="bg-white border border-line rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="w-16 h-16 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-white text-2xl font-medium"
            >
              {initial}
            </div>
          )}
          <div>
            <p className="text-lg font-bold text-ink">{displayName ?? "—"}</p>
            <p className="text-sm text-gray-500">{email}</p>
          </div>
        </div>
      </section>

      {/* Account info */}
      <section className="bg-white border border-line rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          账号信息
        </h2>
        <dl className="space-y-3">
          <Row label="登录方式" value={providerLabel(provider)} />
          <Row label="账号创建" value={formatDate(createdAt)} />
          <Row label="上次登录" value={formatDateTime(lastSignInAt)} />
          <Row label="邮箱已验证" value={emailConfirmed} />
          <Row label="User ID" value={userId} mono />
        </dl>
      </section>

      {/* Learning stats */}
      <section className="bg-white border border-line rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          学习统计
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="词汇量" value={`${wordCount}`} />
          <Stat label="复习次数" value={`${reviewCount}`} />
        </div>
      </section>

      {/* Sign out */}
      <form action={signOutAction}>
        <button
          type="submit"
          className="w-full px-6 py-3 rounded-lg text-sm font-medium bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
        >
          退出登录
        </button>
      </form>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-gray-500 flex-shrink-0">{label}</dt>
      <dd
        className={`text-ink text-right break-all ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums text-ink">{value}</p>
    </div>
  );
}
