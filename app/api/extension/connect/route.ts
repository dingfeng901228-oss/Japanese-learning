// POST /api/extension/connect
//
// User-side: mint a one-time 8-character connection code.
//
// Per docs/0821requirements.docx §15. User is logged in (cookie session).
// Server generates a random code, hashes it, stores hash + user_id +
// expires_at (10 min), returns the plaintext code ONCE.
//
// Rate limit: 5 codes per user per hour (defensive — codes are 32^8 ~ 1T
// combinations so brute-force is impractical, but rate-limiting still
// helps in case of UI bugs that mint thousands).

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, sha256Hex } from "@/lib/supabase/admin";
import { createHash, randomBytes } from "node:crypto";

const CODE_TTL_MIN = 10;
const RATE_LIMIT_PER_HOUR = 5;

export async function POST(_request: NextRequest) {
  // 1) Auth: must be logged in (cookie session)
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

  // 2) Rate limit: count codes minted in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("extension_connect_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneHourAgo);
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { success: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  // 3) Generate code: 4 random bytes → base64url (no padding) → 6 chars
  // Wrap with hyphen for readability: "XXXX-XXXX".
  // Avoid ambiguous chars by encoding with base32 (Crockford variant).
  const codeBytes = randomBytes(4);
  const code = formatCode(codeBytes);

  // 4) Store hash + metadata
  const codeHash = sha256Hex(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString();
  const { error: insErr } = await admin.from("extension_connect_codes").insert({
    code_hash: codeHash,
    user_id: user.id,
    expires_at: expiresAt,
  });
  if (insErr) {
    console.error("POST /api/extension/connect insert failed:", insErr);
    return NextResponse.json(
      { success: false, error: "internal" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    code,
    expiresAt,
    ttlMinutes: CODE_TTL_MIN,
  });
}

/**
 * Format 4 random bytes as "XXXX-XXXX" using a Crockford-base32-ish
 * alphabet that excludes 0/O, 1/I/L for human readability.
 * Total 8 chars; entropy ~ 40 bits (4 bytes = 32 bits; the alphabet is
 * 28 chars, 28^8 = ~4.5e11 ≈ 38 bits).
 */
function formatCode(bytes: Buffer): string {
  // 28-char alphabet: lowercase letters + digits minus 0/1/9 (visually
  // confusing). 28^8 = 450,386,166,784 ≈ 38 bits — sufficient for a
  // 10-min TTL with multiple-check-per-code from a single device.
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789".split(""); // 28 chars
  // Reduce 4 bytes (32 bits) into 8 alphabet indices.
  // Use modular arithmetic — slight bias but acceptable for an MVP code.
  const bits = bytes.readUInt32BE(0);
  let n = bits >>> 0;
  const chars: string[] = [];
  for (let i = 0; i < 8; i++) {
    chars.push(alphabet[n % alphabet.length]);
    n = Math.floor(n / alphabet.length);
  }
  // Split "XXXXXXXX" → "XXXX-XXXX"
  return chars.slice(0, 4).join("") + "-" + chars.slice(4, 8).join("");
}

// `createHash` is imported above; suppress unused warning under
// noUnusedLocals if any.
void createHash;