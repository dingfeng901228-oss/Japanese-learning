// POST /api/vocabulary/learning-time
//
// Per docs/0830需求.md §十二: best-effort flush on tab close / page
// refresh via navigator.sendBeacon. The normal flush path uses the
// server action recordVocabLearningTimeAction; this endpoint exists
// specifically so sendBeacon can post JSON before the page is torn
// down (server-action wire format doesn't survive a synchronous
// pagehide event reliably across browsers).
//
// Server-side enforcement (5000ms cap, daily reset, ownership check)
// lives in migration 0006's `increment_vocab_learning_time` RPC.
// This route is a thin wrapper — same `recordVocabLearningTime`
// helper that the server action calls.

import { NextRequest, NextResponse } from "next/server";
import { recordVocabLearningTime } from "@/lib/vocabulary";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      vocabId?: unknown;
      deltaMs?: unknown;
      date?: unknown;
    };

    const vocabId = typeof body.vocabId === "string" ? body.vocabId : "";
    const deltaMs = typeof body.deltaMs === "number" ? body.deltaMs : -1;
    const date = typeof body.date === "string" ? body.date : "";

    if (!vocabId || deltaMs <= 0 || !date) {
      return NextResponse.json(
        { ok: false, error: "invalid_input" },
        { status: 400 }
      );
    }

    // Auth check via Supabase cookie session. The RPC also verifies
    // ownership inside its body — this is the cheap pre-check that
    // lets us 401 unauthenticated requests without an RPC round-trip.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "unauthenticated" },
        { status: 401 }
      );
    }

    const result = await recordVocabLearningTime(vocabId, deltaMs, date);
    return NextResponse.json({
      ok: true,
      learningTimeMs: result.learningTimeMs,
      state: result.state,
    });
  } catch (err) {
    console.error("POST /api/vocabulary/learning-time failed", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
