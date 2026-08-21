// Today Header — date row + Japanese greeting + Chinese subtitle.
//
// The date part is now a client component (TodayDate) so it rolls
// over at midnight without a page refresh — Frank #6631. The date
// tick also calls router.refresh() so server-side data such as
// LearningActivity's daily_rollups is re-fetched against the new
// "today". The countdown is also client (per-second tick).
// Everything else (greeting, subtitle) stays server-rendered since
// it never changes after deploy.

import { TodayCountdown } from "./TodayCountdown";
import { TodayDate } from "./TodayDate";

export function TodayHeader() {
  return (
    <header>
      {/* Per Frank #6621: date + countdown share one row. Date on the
          left, countdown pushed to the rightmost via justify-between.
          flex-wrap + gap-3 so on narrow screens they drop to two rows
          instead of overflowing. */}
      <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-gray-500">
        <p className="tabular-nums">
          <TodayDate />
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
