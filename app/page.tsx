import { TodayHeader } from "@/components/dashboard/TodayHeader";
import { TodayLearning } from "@/components/dashboard/TodayLearning";
import { StreakStats } from "@/components/dashboard/StreakStats";
import { RecentLearning } from "@/components/dashboard/RecentLearning";
import { LearningActivity } from "@/components/dashboard/LearningActivity";
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
