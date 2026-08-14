"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side singleton pattern — one Supabase client per browser tab.
// Phase 2: auth + sign-in only. Phase 3 will reuse this client for
// data reads/writes against the user-scoped tables (see
// supabase/migrations/0001_init.sql + 0002_rls.sql).
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _client;
}
