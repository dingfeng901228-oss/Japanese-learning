import { TodayHeader } from "@/components/dashboard/TodayHeader";
import { TodayLearning } from "@/components/dashboard/TodayLearning";
import { StreakStats } from "@/components/dashboard/StreakStats";
import { RecentLearning } from "@/components/dashboard/RecentLearning";
import { LearningActivity } from "@/components/dashboard/LearningActivity";
import { LearningCalendar } from "@/components/dashboard/LearningCalendar";
import { PhaseBanner } from "@/components/dashboard/PhaseBanner";
import { Footer } from "@/components/dashboard/Footer";

export default function Home() {
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
