"use server";

/**
 * Save the study goals.
 *
 * Audit 2026-11-16 P1-15: there was no settings page, so there was
 * nowhere to set the daily new-word target or the daily review goal.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["daily_new_words", "daily_review_goal"]);

export async function saveSettingsAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return;

  const rows = Array.from(ALLOWED)
    .map((key) => {
      const raw = formData.get(key);
      if (raw === null) return null;
      const n = Math.max(0, Math.min(500, Number(raw) || 0));
      return { user_id: user.id, key, value: String(Math.round(n)) };
    })
    .filter((row): row is { user_id: string; key: string; value: string } =>
      row !== null
    );

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("user_settings")
    .upsert(rows, { onConflict: "user_id,key" });
  if (error) {
    console.error("[settings] save failed:", error.message);
    return;
  }
  revalidatePath("/settings");
}
