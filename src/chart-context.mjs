import { round, shiftDate } from "./domain.mjs";
export function momentRun(bars, index) {
  const eligible = (c) => c?.intraday && !c.recorded;
  if (!eligible(bars[index])) return [index, index];
  let first = index,
    last = index;
  while (first > 0 && eligible(bars[first - 1])) first--;
  while (last + 1 < bars.length && eligible(bars[last + 1])) last++;
  return [first, last];
}
export function periodChanges(days, today) {
  return [30, 90, 180, 365].map((length) => ({
    length,
    delta: round(
      days
        .filter(
          (d) => d.date >= shiftDate(today, 1 - length) && d.date <= today,
        )
        .reduce((n, d) => n + d.delta, 0),
    ),
  }));
}
