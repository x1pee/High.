import { clockLabel } from "./intraday.mjs";
import { dateAt, minuteAt } from "./timeline.mjs";

// Keep future chart space explicitly empty: flat bars carry the last price but
// never claim that a real event or observation happened there.
export function appendFutureBars(
  bars,
  viewportStart,
  viewportEnd,
  observedEnd,
  interval,
  fallbackPrice,
) {
  if (viewportEnd <= observedEnd) return bars;
  const last = bars.at(-1);
  let cursor = Math.max(viewportStart, observedEnd, last?.to ?? -Infinity);
  let price = last?.close ?? fallbackPrice;
  const result = [...bars];
  while (cursor < viewportEnd) {
    const date = dateAt(cursor);
    const origin = minuteAt(date);
    const startMinute = cursor - origin;
    const nextBoundary = origin + (Math.floor(startMinute / interval) + 1) * interval;
    const to = Math.min(viewportEnd, Math.max(cursor + 1, nextBoundary));
    result.push({
      date,
      time: clockLabel(startMinute),
      endTime: clockLabel(to - origin),
      open: price,
      high: price,
      low: price,
      close: price,
      delta: 0,
      percent: 0,
      recorded: false,
      synthetic: false,
      intraday: true,
      future: true,
      title: "",
      note: "",
      events: [],
      realDelta: 0,
      startMinute,
      endMinute: to - origin,
      from: cursor,
      to,
    });
    cursor = to;
  }
  return result;
}
