import { calendar, percentage, round, shiftDate } from "./domain.mjs";

export const TIMEFRAMES = [
  [1, "1м", "1 минута"],
  [5, "5м", "5 минут"],
  [15, "15м", "15 минут"],
  [60, "1ч", "1 час"],
  [240, "4ч", "4 часа"],
  [1440, "1д", "1 день"],
  [10080, "1н", "1 неделя"],
  [43200, "1мес", "1 месяц"],
  [129600, "3мес", "3 месяца"],
  [525600, "1г", "1 год"],
];
export function periodStart(date, interval) {
  const d = new Date(date + "T00:00:00Z");
  if (interval === 10080) return shiftDate(date, -(d.getUTCDay() + 6) % 7);
  if (interval >= 43200) {
    d.setUTCDate(1);
    if (interval === 129600) d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3);
    if (interval === 525600) d.setUTCMonth(0);
  }
  return d.toISOString().slice(0, 10);
}
// Complete calendar buckets at the left edge; the last bucket ends at the observation date.
export function calendarBars(days, initial, start, end, interval = 1440) {
  const daily = calendar(days, initial, periodStart(start, interval), end);
  if (interval === 1440) return daily;
  const result = [];
  for (const day of daily) {
    const key = periodStart(day.date, interval);
    let bar = result.at(-1);
    if (!bar || bar.date !== key) {
      bar = {
        date: key,
        endDate: day.date,
        open: day.open,
        close: day.open,
        high: day.open,
        low: day.open,
        events: [],
        recorded: false,
        title: "",
        note: "",
        aggregate: true,
      };
      result.push(bar);
    }
    bar.endDate = day.date;
    bar.close = day.close;
    bar.high = Math.max(bar.high, day.high);
    bar.low = Math.min(bar.low, day.low);
    bar.recorded ||= day.recorded;
    bar.events.push(...day.events.map((e) => ({ ...e, date: day.date })));
    bar.delta = round(bar.close - bar.open);
    bar.percent = percentage(bar.delta, bar.open);
  }
  return result;
}
