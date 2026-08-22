"use client";

// Learning Calendar — client component.
// Per Frank #6671 (UI优化.docx): 正常日历 + 当月打卡 + 历史打卡.
//
// Layout:
//   ┌─ Top bar: 标题 + 本月统计 + 月份 nav + 「今天」按钮 ─┐
//   ├─ Weekday header: 日 月 火 水 木 金 土 ─────────────┤
//   └─ 6×7 grid: 每月固定 6 行 7 列 = 42 cells ───────────┘
//
// Check-in indicator: 当天 daily_rollups.minutes > 0 → cell 浅绿底 +
// 底部 1px 绿点；今天 → 1px ring；非本月 → 灰文字。
// 月份 nav: prev/next 按钮；下个月若是未来月份 → 按钮 disabled。
// 「今天」按钮：仅当 view 不是当前月时显示。
//
// Data shape from server:
//   Array<{ date: "YYYY-MM-DD", minutes: number }> — 最多 365 天
//   （calendar 用过去 365 天足够，再远就 1px 绿点会失真）

import { useMemo, useState } from "react";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export interface LearningCalendarClientProps {
  data: Array<{ date: string; minutes: number }>;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function LearningCalendarClient({ data }: LearningCalendarClientProps) {
  // O(1) 查表用。365 天 → Set 也才 ~365 strings，内存不是问题。
  const activeDays = useMemo(() => {
    const set = new Set<string>();
    for (const d of data) {
      if (d.minutes > 0) set.add(d.date);
    }
    return set;
  }, [data]);

  // today 用 useMemo 锁定 mount 时刻的「今天」。客户端跨日变化由
  // NextDate / TodayDate 那边负责（每分钟 tick），calendar 只看 date
  // 是不是当前 view 的当前日，不主动 tick 跨日。
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // 默认打开 = 当前月。
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-11

  // 当月天数 + 当月 1 号星期几（0 = 周日 … 6 = 周六）。
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const cells = useMemo(() => {
    const result: Array<{
      year: number;
      month: number;
      day: number;
      inMonth: boolean;
      active: boolean;
      isToday: boolean;
    }> = [];

    // 上月 padding（让 1 号对齐到正确的星期列）
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const d = new Date(viewYear, viewMonth - 1, day);
      const dateStr = formatDate(d);
      result.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        day,
        inMonth: false,
        active: activeDays.has(dateStr),
        isToday: false,
      });
    }

    // 当月
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      const dateStr = formatDate(d);
      const isToday =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
      result.push({
        year: viewYear,
        month: viewMonth,
        day,
        inMonth: true,
        active: activeDays.has(dateStr),
        isToday,
      });
    }

    // 下月 padding（补足 42 cells = 6 行 × 7 列）
    const remaining = 42 - result.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(viewYear, viewMonth + 1, day);
      const dateStr = formatDate(d);
      result.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        day,
        inMonth: false,
        active: activeDays.has(dateStr),
        isToday: false,
      });
    }

    return result;
  }, [viewYear, viewMonth, daysInMonth, firstDayOfWeek, activeDays, today]);

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const isFutureMonth =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  // 本月统计：从 cells 拿 inMonth + active 计数 + 从 data 算本月总分钟。
  // 用 cells 算「天数」、data 算「总分钟」是因为 cells 已经 include 上/下月
  // padding，要 filter inMonth。data 是按 date 字串匹配，逻辑上等价。
  const monthlyActive = useMemo(() => {
    return cells.filter((c) => c.inMonth && c.active).length;
  }, [cells]);

  const monthlyMinutes = useMemo(() => {
    return Math.round(
      data
        .filter((d) => {
          const dt = new Date(d.date + "T00:00:00");
          return (
            dt.getFullYear() === viewYear && dt.getMonth() === viewMonth
          );
        })
        .reduce((s, d) => s + d.minutes, 0)
    );
  }, [data, viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (isFutureMonth) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  return (
    <section className="bg-white border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-ink">📅 学习日历</h2>
          <span className="text-xs text-gray-500">
            本月 {monthlyActive} 天打卡 · {monthlyMinutes} 分
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 flex items-center justify-center"
            aria-label="上个月"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-ink tabular-nums min-w-[88px] text-center">
            {viewYear} 年 {viewMonth + 1} 月
          </span>
          <button
            type="button"
            onClick={nextMonth}
            disabled={isFutureMonth}
            className="w-7 h-7 rounded-md text-gray-500 hover:bg-gray-100 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="下个月"
          >
            ›
          </button>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={goToToday}
              className="ml-1 text-xs px-2 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              今天
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={`text-center text-xs font-medium py-1 ${
              i === 0
                ? "text-red-500"
                : i === 6
                  ? "text-blue-500"
                  : "text-gray-500"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs relative ${
              cell.inMonth
                ? cell.active
                  ? "bg-green-50 text-ink font-medium"
                  : "text-gray-700"
                : "text-gray-300"
            } ${cell.isToday ? "ring-1 ring-ink" : ""}`}
          >
            <span>{cell.day}</span>
            {cell.active && cell.inMonth && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-green-500" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
