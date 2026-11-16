// Admin gate for the /admin/* tooling.
//
// Audit 2026-11-16 P1-16: /admin/import-vocab was protected by the
// login gate only, so ANY signed-in account could open the bulk-import
// page and post to its server actions.
//
// The allow-list lives in the database (public.app_admins) and is read
// through the SECURITY DEFINER function public.is_admin(), so it
// cannot be edited from the client and does not recurse through RLS.
//
// Both the PAGE and every SERVER ACTION call this — gating the page
// alone would leave the actions reachable by a direct POST.

import { createClient } from "@/lib/supabase/server";

/**
 * Is the current session an admin?
 *
 * Returns false — never throws — when Supabase is not configured, the
 * visitor is not logged in, or the RPC fails. A failure to reach the
 * allow-list must never open the admin tooling.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    if (!supabase) return false;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return false;

    const { data, error } = await supabase.rpc("is_admin");
    if (error) {
      console.error("[admin] is_admin rpc failed:", error.message);
      return false;
    }
    return data === true;
  } catch (err) {
    if ((err as Error).message !== "supabase_env_missing") {
      console.error("[admin] admin check failed:", err);
    }
    return false;
  }
}
