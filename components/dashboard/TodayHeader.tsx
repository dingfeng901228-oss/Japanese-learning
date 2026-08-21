// Today Header — date + Japanese weekday + countdown to end-of-day
// (per Frank #6615 #1 #2) + Japanese greeting + Chinese subtitle
// (spec §9). Server component shell — the countdown is a separate
// client component (TodayCountdown) that handles the 1-Hz tick.
//
// Japanese weekday via a manual lookup (Date.prototype.getDay()) so the
// output is identical on Node.js (Vercel server-side render) and in
// the browser — no risk of hydration mismatch from a divergent ICU
// between runtimes.

import { TodayCountdown } from "./TodayCountdown";

const JA_WEEKDAYS = [
  "日曜日", // 0 Sunday
  "月曜日", // 1 Monday
  "火曜日", // 2 Tuesday
  "水曜日", // 3 Wednesday
  "木曜日", // 4 Thursday
  "金曜日", // 5 Friday
  "土曜日", // 6 Saturday
];

export function TodayHeader() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekday = JA_WEEKDAYS[now.getDay()];

  return (
    <header>
      {/* Per Frank #6621: date + countdown share one row. Date on the
          left, countdown pushed to the rightmost via justify-between.
          flex-wrap + gap-3 so on narrow screens they drop to two rows
          instead of overflowing. */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-gray-500">
        <p className="tabular-nums">
          {year}年{month}月{day}日 · {weekday}
        </p>
        <TodayCountdown />
      </div>
      <h1 className="font-jp text-[32px] md:text-[40px] font-bold mt-3 leading-tight text-ink">
        今日も、日本語を使おう。
      </h1>
      <p className="font-sc text-[18px] mt-2 text-gray-700">
        今天也使用日语吧。
      </p>
    </header>
  );
}
