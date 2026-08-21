/**
 * Service-role Supabase client — bypasses RLS.
 *
 * Use ONLY in API routes that have already verified user identity via an
 * out-of-band mechanism (e.g. Extension Token → user_id mapping). Never
 * expose to client code or use without auth precheck.
 *
 * Cached as a module-level singleton — `createClient` allocates an HTTP
 * agent + parses URL once; reusing is safe and saves ~5-15ms per call.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { Database } from "./database";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient(): ReturnType<typeof createClient<Database>> {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error(
        "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). " +
          "Check .env.local / Vercel project settings.",
      );
    }
    adminClient = createClient<Database>(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return adminClient;
}

/** SHA-256 hex digest of an arbitrary string. Used for token hashing. */
export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}