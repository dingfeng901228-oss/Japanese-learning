// Anonymous hero — replaces the dashboard for unauthenticated visitors.
//
// Per audit 2026-10-09 P0-1: the previous home page rendered the full
// dashboard for everyone; signed-out visitors saw a wall of zeros
// (0% progress, 0h 0m, empty calendar) with no explanation. That reads
// as "this site is empty/broken" instead of "you need an account".
//
// This is a server component. It renders 100% statically — no Supabase
// reads — so signed-out first-paint is cacheable and instant. The
// three feature cards are honest descriptions of what's behind
// /listening / /speaking / /vocabulary, not fake demo data.

import Link from "next/link";

interface FeatureCard {
  href: string;
  emoji: string;
  title: string;
  body: string;
}

const FEATURES: FeatureCard[] = [
  {
    href: "/listening",
    emoji: "🎧",
    title: "听力",
    body: "NHK 新闻、日剧片段、跟读影子训练 — 一句一句循环听，影子跟读纠正节奏。",
  },
  {
    href: "/speaking",
    emoji: "🎤",
    title: "口语",
    body: "AI 实时纠音 + 真人发音参考，把每个音节练到跟得上日本同事开会。",
  },
  {
    href: "/vocabulary",
    emoji: "📚",
    title: "词汇",
    body: "JLPT N2-N1 词库 + 间隔重复 — 每天 10 个新词、复习该复习的、不浪费时间。",
  },
];

export function AnonymousHero() {
  return (
    <div className="py-12 md:py-20">
      {/* Lead — JP greeting + CN subtitle + dual CTA */}
      <section className="max-w-3xl">
        <p className="text-sm text-gray-500 tabular-nums">
          今日も、日本語を使おう。
        </p>
        <h1 className="font-jp text-[36px] md:text-[52px] font-bold mt-3 leading-[1.15] text-ink">
          学習を「記録」する。
          <br />
          <span className="text-gray-500">そして、「使える」ようにする。</span>
        </h1>
        <p className="mt-6 text-base md:text-lg text-gray-700 leading-relaxed max-w-xl">
          FastStudy 是一个为来日生活准备的私人日语学习中心。
          听力 / 口语 / 词汇 / 复习 — 每天 30 分钟,三个月后能跟得上会议室的节奏。
        </p>

        {/* Dual CTA: primary (start) + secondary (sign in) */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-ink text-white font-medium hover:bg-gray-800 transition-colors"
          >
            开始学习
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-12 px-6 rounded-lg border border-line bg-white text-ink font-medium hover:bg-gray-50 transition-colors"
          >
            已有账号 · 登录
          </Link>
        </div>

        {/* Quiet reassurance — addresses the "is this safe / will my data leak" concern
            that always comes up for a personal-site SaaS */}
        <p className="mt-4 text-xs text-gray-400">
          数据仅你本人可见。不卖、不分析、不外发。
        </p>
      </section>

      {/* Feature trio — what the dashboard will look like once you sign in */}
      <section className="mt-16 md:mt-24">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          三大训练模块
        </h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="block p-5 rounded-xl border border-line bg-white hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <p className="text-2xl" aria-hidden="true">
                {f.emoji}
              </p>
              <h3 className="font-jp text-lg font-bold text-ink mt-3">
                {f.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                {f.body}
              </p>
              <p className="text-xs text-gray-400 mt-3">预览 →</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}