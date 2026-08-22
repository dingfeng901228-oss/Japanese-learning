// /components/dashboard/LearningCalendar.tsx
//
// Per Frank #6671 (UI优化.docx): 学习日历 模块 = 正常日历 + 当月打卡
// + 历史打卡。Server Component 拉 daily_rollups 过去 365 天的数据，
// 渲染成 client 组件（月份导航 + check-in indicator 都是 client state）。
//
// 数据源跟 LearningActivity 共用 daily_rollups（Supabase 真实数据）—
// 之前 LineChart 用同一份数据展示 365 天趋势，Calendar 用同一份数据
// 按月切分展示 check-in 状态。两个模块数据完全一致，不会出现「折线图
// 显示有训练但日历没有点」或反过来的情况。
//
// Supabase 没接好 / daily_rollups 表缺 / 网络挂了 → fall through 到空
// 数据，client 渲染一个空日历（不会崩）。LearningActivity 同样的容错
// 逻辑。

import { getDailyRollups } from "@/lib/daily-rollups";
import { LearningCalendarClient } from "./LearningCalendarClient";

export async function LearningCalendar() {
  let rollups: Array<{ date: string; minutes: number }> = [];
  try {
    const data = await getDailyRollups(365);
    rollups = data.map((r) => ({
      date: typeof r.date === "string" ? r.date : String(r.date),
      minutes: Number(r.minutes) || 0,
    }));
  } catch {
    // Supabase not ready / table missing / etc. — render empty calendar.
  }

  return <LearningCalendarClient data={rollups} />;
}
