// POST /api/extension/revoke
//
// User-side: revoke an extension token by its row id. The token row's
// `revoked_at` is set; the Chrome extension will get 403 on subsequent
// /api/vocabulary calls (see /api/vocabulary auth check).
//
// Per docs/0821requirements.docx §16 ("支持撤销 / 支持删除").
//
// Body: { tokenId: string }
// Returns: { success: true }
// Errors:
//   401 unauthorized
//   422 invalid_input
//   404 not_found
//   500 internal

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RevokeBody {
  tokenId?: unknown;
}

export async function POST(request: NextRequest) {
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

  let body: RevokeBody;
  try {
    body = (await request.json()) as RevokeBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_json" },
      { status: 422 },
    );
  }
  if (typeof body.tokenId !== "string" || body.tokenId.length === 0) {
    return NextResponse.json(
      { success: false, error: "invalid_input" },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  // Scope by user_id (RLS would block this query if not service role;
  // we already auth'd via cookie session, so manually scope the admin query).
  const { data, error } = await admin
    .from("extension_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", body.tokenId)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("POST /api/extension/revoke failed:", error);
    return NextResponse.json(
      { success: false, error: "internal" },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { success: false, error: "not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}