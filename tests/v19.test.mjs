import test from "node:test";
import assert from "node:assert/strict";
import { createJournal, upsertEvent, calculate } from "../src/domain.mjs";
import { intraday } from "../src/intraday.mjs";
import { momentRun, periodChanges } from "../src/chart-context.mjs";
import { DAY_EXAMPLES, nextDayExample } from "../src/day-examples.mjs";

test("a 5 percent event jumps in its own candle, never in the preceding 0.22 percent event", () => {
  let j = createJournal("Causal", 10000);
  j = upsertEvent(j, {
    date: "2026-09-23",
    time: "12:18",
    text: "Small",
    delta: 0.22,
    unit: "percent",
  });
  j = upsertEvent(j, {
    date: "2026-09-23",
    time: "16:30",
    text: "Large",
    delta: 5,
    unit: "percent",
  });
  const day = calculate(j)[0],
    before = JSON.stringify(day);
  for (const interval of [1, 5, 15, 60, 240])
    for (const interpolate of [true, false]) {
      const bars = intraday(day, interval, { interpolate, until: 1080 });
      const small = bars.find((b) => b.events.some((e) => e.text === "Small"));
      const large = bars.find((b) => b.events.some((e) => e.text === "Large"));
      assert(
        Math.abs(small.delta) < 45,
        `${interval}: earlier event must not anticipate +5%`,
      );
      assert(
        large.delta > 480,
        `${interval}: own candle receives the +5% jump`,
      );
      for (const b of bars.filter((b) => b.endMinute <= 990))
        assert(b.high < 10040, "No anticipatory pump");
      assert.equal(bars.at(-1).close, day.close);
    }
  const minute = intraday(day, 1, { until: 1080 });
  assert.equal(minute[990].open, day.events[1].before);
  assert.equal(minute[990].close, day.events[1].after);
  assert.equal(JSON.stringify(day), before);
});
test("opposite same-minute events retain extrema and exact close with smoothing", () => {
  let j = createJournal("Same minute", 1000);
  for (const delta of [100, -200, 30])
    j = upsertEvent(j, {
      date: "2026-09-23",
      time: "12:00",
      text: "Event",
      delta,
    });
  const d = calculate(j)[0],
    b = intraday(d, 1)[720];
  assert.equal(b.open, 1000);
  assert.equal(b.close, 930);
  assert.equal(b.high, 1100);
  assert.equal(b.low, 900);
});
test("moment selection stops at recorded events and includes neutral gaps", () => {
  const synth = { intraday: true, synthetic: true, recorded: false };
  const bars = [
    { ...synth, recorded: true },
    synth,
    synth,
    synth,
    { ...synth, recorded: true },
    synth,
    { ...synth, synthetic: false },
    synth,
  ];
  assert.deepEqual(momentRun(bars, 2), [1, 3]);
  assert.deepEqual(momentRun(bars, 4), [4, 4]);
  assert.deepEqual(momentRun(bars, 5), [5, 7]);
});
test("rolling statistics include exact lower boundary and exclude future", () => {
  const days = [
    { date: "2026-09-24", delta: 999 },
    { date: "2026-09-23", delta: 1 },
    { date: "2026-08-25", delta: 2 },
    { date: "2026-08-24", delta: 4 },
    { date: "2025-09-24", delta: 8 },
    { date: "2025-09-23", delta: 16 },
  ];
  assert.deepEqual(
    periodChanges(days, "2026-09-23").map((p) => p.delta),
    [3, 7, 7, 15],
  );
});
test("50 day title suggestions are unique and consecutive placeholders differ", () => {
  assert.equal(DAY_EXAMPLES.length, 50);
  assert.equal(new Set(DAY_EXAMPLES).size, 50);
  let last = nextDayExample();
  for (let i = 0; i < 100; i++) {
    const next = nextDayExample();
    assert(DAY_EXAMPLES.includes(next));
    assert.notEqual(last, next);
    last = next;
  }
});
