import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SpeakSpeedPicker } from "@/components/vocabulary/speak-rate";
import { saveSettingsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "设置 · jp.frank2025.com",
};

const DEFAULTS = {
  daily_new_words: 10,
  daily_review_goal: 50,
};

export default async function SettingsPage() {
  let supabase = null;
  let user = null;
  try {
    supabase = await createClient();
    if (supabase) {
      const result = await supabase.auth.getUser();
      user = result.data.user;
    }
  } catch (err) {
    if ((err as Error).message !== "supabase_env_missing") {
      console.error("[settings] failed to load user:", err);
    }
  }
  if (!user || !supabase) redirect("/login");

  const { data: rows } = await supabase
    .from("user_settings")
    .select("key, value")
    .eq("user_id", user.id);

  const saved: Record<string, string> = {};
  for (const row of rows ?? []) saved[row.key] = row.value;

  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <header className="mb-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← 返回首页
        </Link>
        <h1 className="text-3xl font-bold mt-4">⚙️ 设置</h1>
        <p className="text-gray-600 mt-2">
          这里可以调整外观、朗读速度和学习目标。
        </p>
      </header>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">外观</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-900">主题</p>
              <p className="text-xs text-gray-500">
                深色模式会重映射整套配色，本机记住你的选择。
              </p>
            </div>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-900">朗读速度</p>
              <p className="text-xs text-gray-500">
                0.5 / 0.75 / 1.0 / 1.2，全站的发音按钮共用这个速度。
              </p>
            </div>
            <SpeakSpeedPicker />
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-1">学习目标</h2>
        <p className="text-xs text-gray-500 mb-4">
          这两个数字跟账号一起保存，换设备也会跟着你。
        </p>
        <form action={saveSettingsAction} className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-900">每日新词量</span>
            <span className="block text-xs text-gray-500 mb-1">
              每天想学多少个新词。
            </span>
            <input
              type="number"
              name="daily_new_words"
              min={0}
              max={500}
              defaultValue={saved.daily_new_words ?? DEFAULTS.daily_new_words}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-900">每日复习量</span>
            <span className="block text-xs text-gray-500 mb-1">
              每天想复习多少个词。
            </span>
            <input
              type="number"
              name="daily_review_goal"
              min={0}
              max={500}
              defaultValue={saved.daily_review_goal ?? DEFAULTS.daily_review_goal}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <button
            type="submit"
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            保存
          </button>
        </form>
      </section>
    </main>
  );
}
