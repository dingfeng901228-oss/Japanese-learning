import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { TodayHeader } from "@/components/dashboard/TodayHeader";
import { TodayLearning } from "@/components/dashboard/TodayLearning";
import { StreakStats } from "@/components/dashboard/StreakStats";
import { RecentLearning } from "@/components/dashboard/RecentLearning";
import { LearningActivity } from "@/components/dashboard/LearningActivity";
import { LearningCalendar } from "@/components/dashboard/LearningCalendar";
import { PhaseBanner } from "@/components/dashboard/PhaseBanner";
import { Footer } from "@/components/dashboard/Footer";
import { AnonymousHero } from "@/components/dashboard/AnonymousHero";

// Audit 2026-10-09 P2-9: anon visitors get the page served from a
// short CDN cache (60s), so the home route doesn't pound the auth round-
// trip on every page hit. Signed-in users bypass this and always get a
// fresh dashboard render.
export const revalidate = 60;

// Per audit 2026-10-09 P0-1: signed-out visitors used to see a wall of
// zeros (0% progress, 0h 0m, empty calendar) which reads as "this site
// is broken". Now we route them through <AnonymousHero /> — a static,
// cacheable hero — instead of the dashboard. Signed-in users see the
// full dashboard exactly as before.
//
// Audit 2026-10-09 P2-9: we read the `x-has-session` header that the
// middleware sets (see lib/supabase/middleware.ts). This header is the
// only state the home page reads — no cookies touched here, so the page
// can be revalidated by Next.js (revalidate = 60) without breaking the
// dynamic cookie semantics that protected pages need.
//
// `headers()` itself still marks the page as dynamic per Next 15
// semantics — that's a known framework limitation. The CDN revalidation
// is the real win: anon hits are served from Cloudflare's edge cache
// for 60s without hitting the Next.js server at all.
export default async function Home() {
  // Fast path: trust the middleware-set header (avoids getUser() round
  // trip). Fall back to a getUser() check if the header is missing
  // (e.g. local dev where middleware may not run before the page handler
  // in some setups).
  const headerSession = (await headers()).get("x-has-session");
  let isSignedIn = headerSession === "1";

  if (headerSession === null) {
    try {
      const supabase = await createClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        isSignedIn = !!user;
      }
    } catch (err) {
      if ((err as Error).message !== "supabase_env_missing") {
        console.error("[home] getUser() failed:", err);
      }
      isSignedIn = false;
    }
  }

  if (!isSignedIn) {
    return (
      <main className="max-w-[1200px] mx-auto px-6 py-10">
        <AnonymousHero />
        <Footer />
      </main>
    );
  }

  return (
    <main className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <TodayHeader />
        </div>
        <div className="col-span-12 lg:col-span-8">
          <TodayLearning />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <StreakStats />
        </div>
        <div className="col-span-12">
          <RecentLearning />
        </div>
        {/* Per Frank #6671 (UI优化.docx): 学习日历 插在 最近学习 和
            学习足迹 之间。日历展示「哪天打了卡」+ 历史月份可看，
            折线图展示「每天学习多少分钟」+ 范围切换 — 两者互补
            （日历 = 二元打卡、折线图 = 连续分钟数），不重复。 */}
        <div className="col-span-12">
          <LearningCalendar />
        </div>
        <div className="col-span-12">
          <LearningActivity />
        </div>
        <div className="col-span-12">
          <PhaseBanner />
        </div>
      </div>
      <Footer />
    </main>
  );
}
