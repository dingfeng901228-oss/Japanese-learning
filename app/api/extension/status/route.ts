// GET /api/extension/status
//
// User-side: list the user's extension tokens (active + revoked).
//
// Per docs/0821requirements.docx §16 ("支持查看创建时间 / 支持查看最后使用
// 时间 / 支持删除 / 支持重新生成").
//
// Returns: { success: true, tokens: [{ id, label, createdAt, lastUsedAt,
//   revokedAt, browserSourcedCount }] }
//
// `browserSourcedCount` counts vocabulary items inserted via the Chrome
// extension (source = 'chrome-extension') — gives the user a sense of
// how much value they're getting from the extension.
//
// Errors:
//   401 unauthorized
//   500 internal

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const { data: tokens, error: tokenErr } = await admin
    .from("extension_tokens")
    .select("id, label, created_at, last_used_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (tokenErr) {
    console.error("GET /api/extension/status token query failed:", tokenErr);
    return NextResponse.json(
      { success: false, error: "internal" },
      { status: 500 },
    );
  }

  // Total vocab items saved via the extension (all-time) for the user.
  // One count query — cheap and informs the "我有多少词汇来自浏览器阅读"
  // stat on the settings page.
  const { count: browserSourcedCount, error: countErr } = await admin
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("source", "chrome-extension");
  if (countErr) {
    console.error("GET /api/extension/status count query failed:", countErr);
  }

  return NextResponse.json({
    success: true,
    tokens: (tokens ?? []).map((t) => ({
      id: t.id,
      label: t.label,
      createdAt: t.created_at,
      lastUsedAt: t.last_used_at,
      revokedAt: t.revoked_at,
    })),
    browserSourcedCount: browserSourcedCount ?? 0,
  });
}