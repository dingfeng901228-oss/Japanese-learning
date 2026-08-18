// Today Header — date + Japanese greeting + Chinese subtitle (spec §9).
// Server component (no state, no interactivity).

export function TodayHeader() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });

  return (
    <header>
      <p className="text-sm text-gray-500 tabular-nums">
        {year}年{month}月{day}日 · {weekday}
      </p>
      <h1 className="font-jp text-[32px] md:text-[40px] font-bold mt-3 leading-tight text-ink">
        今日も、日本語を使おう。
      </h1>
      <p className="font-sc text-[18px] mt-2 text-gray-700">
        今天也使用日语吧。
      </p>
    </header>
  );
}
