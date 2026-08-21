// POST /api/extension/redeem
//
// Extension-side: exchange a one-time connection code for a long-term
// Bearer token. NO cookie session — the code IS the credential.
//
// Per docs/0821requirements.docx §15 + §16.
//   Body: { code: "XXXX-XXXX" }
//   Returns: { success, token, label, expiresAt }
//     - token: 32-byte base64url string (~43 chars), shown ONCE
//     - label: free-form "Chrome / Windows" — auto-generated from UA
//
// Errors:
//   401 invalid_code | expired_code | already_consumed
//   422 invalid_input
//   500 internal

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, sha256Hex } from "@/lib/supabase/admin";
import { randomBytes } from "node:crypto";

interface RedeemBody {
  code?: unknown;
}

export async function POST(request: NextRequest) {
  // 1) Parse body
  let body: RedeemBody;
  try {
    body = (await request.json()) as RedeemBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_json" },
      { status: 422 },
    );
  }
  if (typeof body.code !== "string" || !/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(body.code)) {
    return NextResponse.json(
      { success: false, error: "invalid_code_format" },
      { status: 422 },
    );
  }
  const codeHash = sha256Hex(body.code);

  const admin = createAdminClient();

  // 2) Lookup code
  const { data: codeRow, error: codeErr } = await admin
    .from("extension_connect_codes")
    .select("user_id, expires_at, consumed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (codeErr) {
    console.error("POST /api/extension/redeem code lookup failed:", codeErr);
    return NextResponse.json(
      { success: false, error: "internal" },
      { status: 500 },
    );
  }
  if (!codeRow) {
    return NextResponse.json(
      { success: false, error: "invalid_code" },
      { status: 401 },
    );
  }
  if (codeRow.consumed_at) {
    return NextResponse.json(
      { success: false, error: "already_consumed" },
      { status: 401 },
    );
  }
  if (new Date(codeRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { success: false, error: "expired_code" },
      { status: 401 },
    );
  }

  // 3) Mark consumed atomically (compare-and-swap via UPDATE + filter).
  // Use single update with .eq() filter; if 0 rows updated, another
  // request consumed it first.
  const { data: consumedRow, error: consumeErr } = await admin
    .from("extension_connect_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("code_hash", codeHash)
    .is("consumed_at", null)
    .select("user_id")
    .maybeSingle();
  if (consumeErr) {
    console.error("POST /api/extension/redeem consume failed:", consumeErr);
    return NextResponse.json(
      { success: false, error: "internal" },
      { status: 500 },
    );
  }
  if (!consumedRow) {
    return NextResponse.json(
      { success: false, error: "already_consumed" },
      { status: 401 },
    );
  }
  const userId = consumedRow.user_id;

  // 4) Mint token (32 random bytes → base64url ~ 43 chars)
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);

  // 5) Best-effort: derive a label from User-Agent (e.g. "Chrome / Windows").
  const label = deriveLabel(request.headers.get("user-agent") ?? "");

  const { error: tokenErr } = await admin.from("extension_tokens").insert({
    user_id: userId,
    token_hash: tokenHash,
    label,
  });
  if (tokenErr) {
    console.error("POST /api/extension/redeem token insert failed:", tokenErr);
    return NextResponse.json(
      { success: false, error: "internal" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    token, // plaintext — shown ONCE
    label,
  });
}

function deriveLabel(ua: string): string {
  // Defensive defaults
  let browser = "Chrome";
  let os = "Unknown OS";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";

  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|macOS/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";

  return `${browser} / ${os}`;
}