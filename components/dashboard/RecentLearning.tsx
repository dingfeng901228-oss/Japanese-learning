// Recent Learning — spec §15. Server component, pulls latest 5
// vocabulary_items from Supabase and renders a quiet timeline.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const TYPE_LABELS: Record<string, string> = {
  word: "词汇",
  phrase: "短语",
  grammar: "语法",
  sentence: "句子",
};

function formatDate(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export async function RecentLearning() {
  let items: Array<{
    id: string;
    word: string;
    type: string;
    level: string | null;
    created_at: string;
  }> = [];

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("vocabulary_items")
        .select("id, word, type, level, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      items = data ?? [];
    }
  } catch {
    // ignore
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        最近学习
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 py-6">
          还没有学习记录。{" "}
          <Link href="/today" className="text-ink hover:underline">
            开始第一次训练
          </Link>
          。
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/vocabulary/${item.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs text-gray-500 w-12 flex-shrink-0 tabular-nums">
                    {formatDate(item.created_at)}
                  </span>
                  <span className="font-jp text-base text-ink truncate">
                    {item.word}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
                  <span>{TYPE_LABELS[item.type] ?? item.type}</span>
                  {item.level && (
                    <span className="text-gray-400">· {item.level}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
