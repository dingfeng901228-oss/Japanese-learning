// POST /api/vocabulary/distractors
//
// Per Frank #6372: returns 3 AI-generated "easily confused" wrong
// answers per vocab item, used by the /review page's multiple-choice
// mode.
//
// Currently the /review page calls lib/vocabulary/distractors.ts
// directly server-side (no HTTP round-trip — see app/review/page.tsx).
// This route is kept for future use cases: per-vocab pre-generation
// on vocab creation, batch admin tools, etc.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDistractors } from "@/lib/vocabulary/distractors";

// One LLM call for the whole batch — ~3s for 22 items. 60s headroom.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    items?: Array<{
      id: string;
      word: string;
      meaning: string;
      reading: string | null;
      type: string;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const requested = body.items ?? [];
  if (requested.length === 0) {
    return NextResponse.json({ distractors: {} });
  }

  // Defensive: ensure every requested id belongs to the current user
  // (RLS would also block unauthorized reads, but this avoids
  // accidentally leaking which vocab_ids exist via 400/200 response shape).
  const requestedIds = requested.map((it) => it.id);
  const { data: userVocab } = await supabase
    .from("vocabulary_items")
    .select("id")
    .eq("user_id", user.id)
    .in("id", requestedIds);
  const ownedIds = new Set((userVocab ?? []).map((v) => v.id));
  const safeItems = requested.filter((it) => ownedIds.has(it.id));

  const sets = await generateDistractors(safeItems);

  const map: Record<string, string[]> = {};
  for (const s of sets) {
    map[s.id] = s.distractors;
  }
  return NextResponse.json({ distractors: map });
}
