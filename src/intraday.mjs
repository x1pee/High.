import { round, percentage } from "./domain.mjs";
export const minuteOf = (time) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const clockLabel = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
// Deterministic bridge. The envelope is zero at both real anchors.
// Interpolated values are never written to the journal or included in daily totals.
export function bridgeValue(a, b, t, seed = 0, animated = true, strength = 1) {
  if (t <= a.t) return a.value;
  if (t >= b.t) return b.value;
  const u = (t - a.t) / (b.t - a.t),
    line = a.value + (b.value - a.value) * u;
  if (!animated) return a.value;
  const amp =
    Math.max(
      0.0001,
      Math.abs(b.value - a.value) * 0.22,
      Math.max(Math.abs(a.value), Math.abs(b.value)) * 0.001,
    ) * strength;
  const phase = (seed % 37) * 0.31;
  const value =
    line +
    amp *
      Math.sin(Math.PI * u) *
      (Math.sin(u * Math.PI * 8 + phase) * 0.67 +
        Math.sin(u * Math.PI * 19 + phase * 0.5) * 0.33);
  return a.value >= 0.01 && b.value >= 0.01 ? Math.max(0.01, value) : value;
}
export function intraday(
  day,
  interval = 1,
  { interpolate = true, until = 1440, strength = 1, visualEmpty = false } = {},
) {
  if (![1, 5, 15, 60, 240].includes(interval))
    throw new Error("Unsupported interval");
  until = Math.max(1, Math.min(1440, Math.floor(until)));
  const events = day.events.map((e) => ({
    ...e,
    minute: minuteOf(e.time ?? "12:00"),
  }));
  // No observations means no series, including note-only days.
  if (!events.length && !(visualEmpty && interpolate)) return [];
  until = Math.max(until, ...events.map((e) => e.minute + 1));
  const anchors = [{ t: 0, value: day.open }],
    seed = Number(day.date.replaceAll("-", ""));
  // Keep an event's jump inside its own minute. A bridge to the NEXT after-value
  // would anticipate that event and incorrectly attribute its weight to earlier bars.
  for (let i = 0; i < events.length;) {
    const first = events[i];
    let last = first;
    while (++i < events.length && events[i].minute === first.minute)
      last = events[i];
    if (anchors.at(-1).t < first.minute)
      anchors.push({ t: first.minute, value: first.before });
    anchors.push({ t: first.minute + 1, value: last.after, event: true });
  }
  if (anchors.at(-1).t < until) anchors.push({ t: until, value: day.close });
  function valueAt(t) {
    let prev = anchors[0];
    for (let i = 1; i < anchors.length; i++) {
      const next = anchors[i];
      if (t < next.t) {
        if (next.event)
          return interpolate
            ? prev.value +
                (next.value - prev.value) * ((t - prev.t) / (next.t - prev.t))
            : prev.value;
        return bridgeValue(prev, next, t, seed + prev.t, interpolate, strength);
      }
      prev = next;
    }
    return prev.value;
  }
  const out = [];
  let previous = day.open;
  for (let start = 0; start < until; start += interval) {
    const stop = Math.min(until, start + interval),
      own = events.filter((e) => e.minute >= start && e.minute < stop);
    const close = valueAt(stop);
    let high = Math.max(previous, close),
      low = Math.min(previous, close);
    for (let t = start; t < stop; t += 0.25) {
      const v = valueAt(t);
      high = Math.max(high, v);
      low = Math.min(low, v);
    }
    for (const e of own) {
      high = Math.max(high, e.after, e.before);
      low = Math.min(low, e.after, e.before);
    }
    const delta = close - previous;
    out.push({
      date: day.date,
      time: clockLabel(start),
      endTime: clockLabel(stop),
      open: previous,
      high,
      low,
      close,
      delta,
      percent: percentage(delta, previous),
      recorded: own.length > 0,
      synthetic: interpolate,
      intraday: true,
      // Event details stay in the event list. The candle title is the day name,
      // or the generic movement label if the user has not named that day.
      title: day.title ?? "",
      note: "",
      events: own,
      realDelta: round(own.reduce((sum, e) => sum + e.delta, 0)),
      startMinute: start,
      endMinute: stop,
    });
    previous = close;
  }
  return out;
}
