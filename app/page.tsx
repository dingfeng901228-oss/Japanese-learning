import { createClient } from "@/lib/supabase/server";
import { TodayHeader } from "@/components/dashboard/TodayHeader";
import { TodayLearning } from "@/components/dashboard/TodayLearning";
import { StreakStats } from "@/components/dashboard/StreakStats";
import { RecentLearning } from "@/components/dashboard/RecentLearning";
import { LearningActivity } from "@/components/dashboard/LearningActivity";
import { LearningCalendar } from "@/components/dashboard/LearningCalendar";
import { PhaseBanner } from "@/components/dashboard/PhaseBanner";
import { Footer } from "@/components/dashboard/Footer";
import { AnonymousHero } from "@/components/dashboard/AnonymousHero";

// Per audit 2026-10-09 P0-1: signed-out visitors used to see a wall of
// zeros (0% progress, 0h 0m, empty calendar) which reads as "this site
// is broken". Now we route them through <AnonymousHero /> — a static,
// cacheable hero — instead of the dashboard. Signed-in users see the
// full dashboard exactly as before.
//
// We check `auth.getUser()` here (one DB round-trip) instead of relying
// on the layout's already-resolved userInfo, because the dashboard
// components themselves re-call `getUser()` and we want a single source
// of truth for the routing decision. Wrapped in try/catch so a Supabase
// outage on the public landing page falls through to the hero (not a
// 500) — the hero has no DB dependency.
export default async function Home() {
  let isSignedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    isSignedIn = !!user;
  } catch {
    // Supabase unreachable / env vars missing — treat as anonymous so
    // the hero still renders. The dashboard would have errored anyway
    // because every dashboard component calls getUser() too.
    isSignedIn = false;
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
