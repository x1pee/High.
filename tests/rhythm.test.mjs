import test from "node:test";
import assert from "node:assert/strict";
import { calculate, createJournal, upsertEvent } from "../src/domain.mjs";
import { intraday } from "../src/intraday.mjs";
import { timeline, minuteAt } from "../src/timeline.mjs";
import { rhythmAmplitude, rhythmValue } from "../src/rhythm.mjs";
import { visualCandle } from "../src/visual-candles.mjs";

function fixture(nextTime = "00:11", nextDelta = 5) {
  let journal = createJournal("Anchors", 100);
  journal = upsertEvent(journal, { date: "2026-10-21", time: "00:00", text: "A", delta: 10, unit: "percent" });
  journal = upsertEvent(journal, { date: "2026-10-21", time: nextTime, text: "B", delta: nextDelta, unit: "percent" });
  return journal;
}

test("visual amplitude grows with candle count and every sampled wick obeys the half-impulse ceiling", () => {
  assert.equal(rhythmAmplitude(10, 1), 0.1);
  assert.equal(rhythmAmplitude(10, 10), 1);
  assert.equal(rhythmAmplitude(10, 1000), 5);
  for (const strength of [1, 4, 8])
    for (const count of [1, 10, 50, 500]) {
      const cap = rhythmAmplitude(10, count, strength);
      for (let sample = 0; sample <= 2000; sample++) {
        const t = count * sample / 2000;
        const value = rhythmValue(110, 10, 0, count, t, 1, 7, strength);
        assert(Math.abs(value - 110) <= cap + 1e-12);
        assert(Math.abs(value - 110) <= 5 + 1e-12);
      }
      assert.equal(rhythmValue(110, 10, 0, count, 0, 1, 7, strength), 110);
      assert.equal(rhythmValue(110, 10, 0, count, count, 1, 7, strength), 110);
    }
});

test("minute and hourly real bodies retain exact recorded percentage after visual pullbacks", () => {
  const journal = fixture("04:00"), day = calculate(journal)[0];
  const unchanged = JSON.stringify(journal);
  for (const interval of [1, 5, 15, 60, 240]) {
    const bars = intraday(day, interval, { until: 301 });
    const index = bars.findIndex(bar => bar.events.some(event => event.text === "B"));
    const real = bars[index];
    assert.equal(real.open, 110);
    assert.equal(real.close, 115.5);
    assert.equal(real.percent, 5);
    if (index) assert.equal(bars[index - 1].close, real.open);
    assert.equal(bars.at(-1).close, real.close);
    assert.equal(bars.reduce((sum, bar) => sum + bar.realDelta, 0), 15.5);
    const visual = bars.filter(bar => !bar.recorded && bar.startMinute > 0 && bar.endMinute <= real.startMinute);
    const cap = rhythmAmplitude(10, visual.length);
    for (const bar of visual.map(visualCandle)) {
      assert(bar.high <= 110 + cap + 1e-12);
      assert(bar.low >= 110 - cap - 1e-12);
    }
  }
  assert.equal(JSON.stringify(journal), unchanged);
});

test("one closed visual candle keeps a visible sampled wick without faking a body jump", () => {
  const day = calculate(fixture("00:02"))[0];
  const bar = intraday(day, 1, { until: 3 })[1];
  assert.equal(bar.open, 110);
  assert.equal(bar.close, 110);
  assert(bar.high > 110 || bar.low < 110);
  const display = visualCandle(bar);
  assert.equal(display.high, bar.high);
  assert.equal(display.low, bar.low);
  assert(bar.high <= 110.1 && bar.low >= 109.9);
});

test("visual gaps use only the previous actual impulse, never a following pump or dump", () => {
  const journal = fixture(), event = journal.events[1];
  const altered = upsertEvent(journal, { ...event, delta: -50 }, event.id);
  const origin = minuteAt("2026-10-21"), horizon = origin + 12;
  const a = timeline(calculate(journal), 100, 1, origin, horizon);
  const b = timeline(calculate(altered), 100, 1, origin, horizon);
  assert.deepEqual(a.filter(bar => !bar.recorded), b.filter(bar => !bar.recorded));
  const real = b.at(-1);
  assert.equal(real.open, 110);
  assert.equal(real.close, 55);
});

test("global gaps cross midnight continuously, retain their shape under panning, and end at the real level", () => {
  let journal = createJournal("Across midnight", 100);
  journal = upsertEvent(journal, { date: "2026-10-20", time: "22:00", text: "Impulse", delta: 10 });
  journal.events[0].id = "repeatable-impulse";
  const days = calculate(journal), origin = minuteAt("2026-10-20"), horizon = origin + 2 * 1440;
  const full = timeline(days, 100, 60, origin, horizon, true, horizon);
  const cropped = timeline(days, 100, 60, origin + 1440, origin + 1440 + 360, true, horizon);
  for (const bar of cropped) assert.deepEqual(bar, full.find(other => other.from === bar.from));
  assert.notEqual(cropped[0].open, 110, "Midnight must not restart the visual gap");
  for (let i = 1; i < full.length; i++) assert.equal(full[i].open, full[i - 1].close);
  assert.equal(full.at(-1).close, 110);
  assert(full.filter(bar => !bar.recorded).every(bar => !bar.events.length && !bar.realDelta));
  const flat = timeline(days, 100, 60, origin, horizon, false, horizon);
  assert(flat.filter(bar => !bar.recorded).every(bar => bar.open === 110 && bar.close === 110 && bar.high === 110 && bar.low === 110 && !bar.synthetic));
});

test("mixed same-minute real events and zero-weight notes preserve extrema and the prior impulse", () => {
  let journal = fixture("00:00", -20);
  journal = upsertEvent(journal, { date: "2026-10-21", time: "00:02", text: "Note", delta: 0 });
  const day = calculate(journal)[0], bars = intraday(day, 1, { until: 10 });
  assert.equal(bars[0].open, 100);
  assert.equal(bars[0].close, 88);
  assert.equal(bars[0].high, 110);
  assert.equal(bars[0].low, 88);
  assert.equal(bars[0].events.length, 2);
  assert.equal(bars[2].open, 88);
  assert.equal(bars[2].close, 88);
  assert(bars.slice(3).some(bar => bar.high !== 88 || bar.low !== 88));
  assert.equal(bars.at(-1).close, 88);
});
