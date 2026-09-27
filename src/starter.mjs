import { localizeUI } from "./i18n.mjs";
import { minuteAt, dateAt } from "./timeline.mjs";
import { clockLabel, minuteOf } from "./intraday.mjs";
import { percentage, localDate, localTime } from "./domain.mjs";

export function createStarter() {
  return {
    remaining: 30,
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
    at: minuteAt(localDate(), minuteOf(localTime())),
  };
}
export const STARTER_CANDLE_MINUTES = 60;
export const starterChoice = () =>
  localizeUI`<fieldset class="starter-choice"><legend>С чего начать</legend><label><input type="radio" name="starterMode" value="manual"><span><b>Чистый график</b><small>Только твои события, с первой записи.</small></span></label><label><input type="radio" name="starterMode" value="visual" checked><span><b>Стартовый ритм <small>(рекомендуется)</small></b><small>Начало графика построено за тебя. Эти свечи не меняют итог или историю.</small></span></label></fieldset>`;

// A disposable display layer. No events or daily statistics are fabricated.
// The seed and consumed count are persisted; editing/deleting a real event
// cannot replenish the starter. The right anchor is always the initial value.
export function starterBars(journal, interval, start, end) {
  const starter = journal.settings.starter;
  if (!starter?.remaining || interval >= 1440) return [];
  const firstReal = journal.events
    .filter((e) => !e.deletedAt)
    .reduce(
      (n, e) => Math.min(n, minuteAt(e.date, minuteOf(e.time))),
      Infinity,
    );
  const anchor =
    Math.floor(Math.min(starter.at, firstReal) / interval) * interval;
  const origin = anchor - 30 * STARTER_CANDLE_MINUTES;
  const initial = journal.settings.initial;
  let state = starter.seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  // Stable for this graph, with a fresh direction and several turning points.
  const startRatio = 0.5 + random();
  const knots = [startRatio];
  for (let i = 1; i < 7; i++) knots.push(0.5 + random());
  knots.push(1);
  const at = (t) => {
    const u = Math.max(0, Math.min(1, (t - origin) / (30 * STARTER_CANDLE_MINUTES)));
    if (u >= 1) return initial;
    const scaled = u * (knots.length - 1), index = Math.floor(scaled);
    const f = scaled - index, smooth = f * f * (3 - 2 * f);
    const ratio = knots[index] + (knots[index + 1] - knots[index]) * smooth;
    return Math.max(0.01, initial * ratio);
  };
  const out = [];
  const remainingStart =
    origin + (30 - starter.remaining) * STARTER_CANDLE_MINUTES;
  for (
    let from = Math.floor(remainingStart / interval) * interval;
    from < anchor;
    from += interval
  ) {
    const a = Math.max(from, remainingStart),
      to = Math.min(anchor, from + interval);
    if (to <= start || a >= end) continue;
    const open = at(a),
      close = at(to);
    let low = Math.min(open, close),
      high = Math.max(open, close);
    for (let t = a; t < to; t += 1) {
      const v = at(t);
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
    const date = dateAt(from),
      startMinute = from - minuteAt(date),
      endMinute = to - minuteAt(date);
    out.push({
      date,
      time: clockLabel(startMinute),
      endTime: clockLabel(endMinute),
      startMinute,
      endMinute,
      from,
      to,
      open,
      close,
      high,
      low,
      delta: close - open,
      percent: percentage(close - open, open),
      recorded: false,
      synthetic: true,
      starter: true,
      intraday: true,
      events: [],
      realDelta: 0,
      title: localizeUI("Стартовый ритм"),
      note: "",
    });
  }
  return out;
}
