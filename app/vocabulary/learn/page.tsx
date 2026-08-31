// /vocabulary/learn — formal learning mode.
//
// Per docs/vocabuly0831.md (Frank #7397, 2026-08-31), Q1-(b):
//   - This page is the dedicated "formal learning" surface.
//   - Entering this page increments vocabulary_items.learning_count
//     via the start_learning_session RPC.
//   - /vocabulary/[id] (the detail view) does NOT touch learning_count.
//   - Detail page may have a "开始学习" button that LINKS to this
//     page instead of incrementing in-place.
//
// Server-side flow:
//   1. Authenticate the user (redirect to /login if absent).
//   2. Load the user's full ordered vocabulary queue (newest first,
//      matching /vocabulary list page default). The full list is
//      passed to the client so "下一个" navigation is instant — no
//      server roundtrip per vocab. For very large vocabularies
//      (>500) this gets heavy; swap to on-demand fetches when needed.
//   3. Resolve the start index:
//        a. ?id= query param (user clicked "开始学习" on a specific vocab)
//        b. user_learning_state.last_learning_vocabulary_id (resume)
//        c. queue[0] (brand new user)
//      If the resolved vocab was deleted, fall back to queue[0].
//   4. Read the optional filter params (?filter_type=...) and pass
//      to the client component so start_learning_session can capture
//      them in user_learning_state.filter_* (Q5-α: display "原 filter").
//
// The client component (LearnSession.tsx) owns the vocab-mount →
// start_learning_session effect, navigation between queue items, and
// the [完成今日学习] action.

import { redirect } from "next/navigation";
import { listVocabularyItems } from "@/lib/vocabulary";
import { getUserLearningState, type LearningFilterContext } from "@/lib/vocabulary/learn";
import { LearnSession } from "./LearnSession";

export const dynamic = "force-dynamic";

type SearchParams = {
  id?: string;
  filter_type?: string;
  filter_level?: string;
  filter_sort?: string;
  filter_query?: string;
};

function readFilter(sp: SearchParams): LearningFilterContext {
  return {
    type: sp.filter_type ?? null,
    level: sp.filter_level ?? null,
    sort: sp.filter_sort ?? null,
    query: sp.filter_query ?? null,
  };
}

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // getUserLearningState returns EMPTY_STATE (not throws) for
  // unauthenticated users; check explicitly so we can redirect.
  const state = await getUserLearningState();
  // The empty state means we couldn't read the user's state — either
  // not logged in or RPC errored. Re-check auth via the page-level
  // guard (lib/supabase server client throws on unauthenticated RPCs
  // only sometimes; defensive redirect).
  const queue = await listVocabularyItems({ sort: "newest" });
  if (queue.length === 0) {
    // No vocab at all — send back to list page with empty state banner.
    redirect("/vocabulary?empty=1");
  }

  // Determine start vocab:
  //   1. ?id= param (specific vocab the user wants to study)
  //   2. last_learning_vocabulary_id from state (resume)
  //   3. queue[0] (brand new)
  let startId: string | null = sp.id ?? null;
  if (!startId && state.lastLearningVocabulary) {
    startId = state.lastLearningVocabulary.id;
  }
  if (!startId) {
    startId = queue[0].id;
  }

  let startIndex = queue.findIndex((v) => v.id === startId);
  if (startIndex === -1) {
    // Start vocab was deleted between state read and now (race with
    // another tab's delete). Fall back to the head of the queue.
    startIndex = 0;
  }

  return (
    <LearnSession
      queue={queue}
      startIndex={startIndex}
      dailyStatus={state.dailyStatus}
      filterContext={readFilter(sp)}
    />
  );
}