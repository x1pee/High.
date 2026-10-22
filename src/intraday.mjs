import { round, percentage } from "./domain.mjs";
import { recordedGroups, rhythmBars, rhythmValue } from "./rhythm.mjs";
export const minuteOf = (time) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const clockLabel = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

// Kept for consumers of the old bridge helper. The chart itself supplies only
// the previous real impulse; a future event is never a source of volatility.
export function bridgeValue(a, b, t, seed = 0, animated = true, strength = 4) {
  if (t <= a.t) return a.value;
  if (t >= b.t) return b.value;
  if (!animated) return a.value;
  const u = (t - a.t) / (b.t - a.t);
  const base = a.value + (b.value - a.value) * u;
  const impulse = Math.max(Math.abs(b.value - a.value), Math.abs(a.value) * 0.001);
  return rhythmValue(base, impulse, a.t, b.t, t, 1, seed, strength);
}

export function intraday(
  day,
  interval = 1,
  { interpolate = true, until = 1440, strength = 4, visualEmpty = false } = {},
) {
  if (![1, 5, 15, 60, 240].includes(interval))
    throw new Error("Unsupported interval");
  until = Math.max(1, Math.min(1440, Math.floor(until)));
  const events = day.events.map((event) => ({
    ...event, at: minuteOf(event.time ?? "12:00"), source: event,
  }));
  if (!events.length && !(visualEmpty && interpolate)) return [];
  until = Math.max(until, ...events.map((e) => e.at + 1));
  const groups = recordedGroups(events, interval, until);
  return rhythmBars(groups, day.open, interval, 0, until, interpolate, strength)
    .map((bar) => ({
      date: day.date,
      time: clockLabel(bar.from), endTime: clockLabel(bar.to),
      open: bar.open, close: bar.close, high: bar.high, low: bar.low,
      delta: bar.close - bar.open,
      percent: percentage(bar.close - bar.open, bar.open),
      recorded: bar.events.length > 0, synthetic: interpolate, intraday: true,
      title: day.title ?? "", note: "", events: bar.events,
      realDelta: round(bar.events.reduce((sum, e) => sum + e.delta, 0)),
      startMinute: bar.from, endMinute: bar.to,
    }));
}
