import test from "node:test";
import assert from "node:assert/strict";
import {
  createJournal,
  calculate,
  calendar,
  percentage,
  upsertEvent,
  upsertDay,
  validateJournal,
  widgetSnapshot,
  shiftDate,
} from "../src/domain.mjs";
import { bridgeValue, intraday } from "../src/intraday.mjs";
const event = (j, delta, time = "12:00", date = "2026-09-20") =>
  upsertEvent(j, { text: "Событие", date, time, delta });
test("OHLC includes initial value and each intraday event in chronological order", () => {
  let j = createJournal("Test", 100);
  j = event(j, -20, "15:00");
  j = event(j, 10, "09:00");
  j = event(j, 5, "20:00");
  const [c] = calculate(j);
  assert.deepEqual([c.open, c.high, c.low, c.close], [100, 110, 90, 95]);
  assert.equal(c.percent, -5);
  assert.equal(c.events[1].percent, -18.18);
});
test("Historical edit and moving a record recalculates subsequent days", () => {
  let j = event(createJournal("Test", 100), 10);
  j = event(j, 20, "12:00", "2026-09-21");
  j = upsertEvent(
    j,
    { text: "changed", date: "2026-09-20", time: "12:00", delta: -50 },
    j.events[0].id,
  );
  assert.equal(calculate(j)[1].close, 70);
  assert.equal(calculate(j)[1].percent, 40);
  j = upsertEvent(
    j,
    { text: "moved", date: "2026-09-22", time: "11:00", delta: -50 },
    j.events[0].id,
  );
  assert.deepEqual(
    calculate(j).map((c) => c.close),
    [120, 70],
  );
  validateJournal(j);
});
test("Decimal amounts do not accumulate binary rounding errors", () => {
  let j = createJournal("Test", 0);
  for (let i = 0; i < 100; i++) j = event(j, 0.1);
  assert.equal(calculate(j)[0].close, 10);
});
test("Zero and negative percentage bases", () => {
  assert.equal(percentage(2, 0), null);
  assert.equal(percentage(5, -100), 5);
  assert.equal(percentage(-5, -100), -5);
});
test("Note-only, deleted events and missing calendar days remain distinct", () => {
  let j = event(createJournal(), 5);
  j.events[0].deletedAt = new Date().toISOString();
  j = upsertDay(j, { date: "2026-09-20", title: "Пауза", note: "" });
  const c = calendar(calculate(j), 1000, "2026-09-19", "2026-09-21");
  assert.equal(c[0].recorded, false);
  assert.equal(c[1].recorded, true);
  assert.equal(c[1].close, 1000);
  assert.equal(c[1].events.length, 0);
});
test("Import rejects malformed dates, duplicate IDs, bad times and invalid amounts", () => {
  const j = event(createJournal(), 2);
  for (const mutate of [
    (x) => (x.events[0].date = "2026-02-30"),
    (x) => (x.events[0].delta = Infinity),
    (x) => (x.events[0].delta = 0.001),
    (x) => (x.events[0].time = "24:01"),
    (x) => x.events.push({ ...x.events[0] }),
    (x) => (x.settings.name = ""),
    (x) => (x.schemaVersion = 999),
  ]) {
    const x = structuredClone(j);
    mutate(x);
    assert.throws(() => validateJournal(x));
  }
});
test("Legacy schema-1 records receive a stable midday time", () => {
  const j = event(createJournal(), 2);
  delete j.events[0].time;
  delete j.settings.interpolate;
  const fixed = validateJournal(j);
  assert.equal(fixed.events[0].time, "12:00");
  assert.equal(fixed.settings.interpolate, true);
});
test("quick-move event metadata persists and rejects invalid counters", () => {
  const j = upsertEvent(createJournal("Test", 1000), {
    text: "Зелёный сигнал (x1)",
    date: "2026-09-24",
    time: "12:00",
    delta: 0.2,
    unit: "percent",
    quickMove: {
      direction: "up",
      count: 1,
      stage: 1,
      variant: 0,
      lastAt: "2026-09-24T12:00:01.000Z",
    },
  });
  assert.equal(validateJournal(j).events[0].quickMove.count, 1);
  assert.equal(
    validateJournal(j).events[0].quickMove.lastAt,
    "2026-09-24T12:00:01.000Z",
  );
  const invalid = structuredClone(j);
  invalid.events[0].quickMove.stage = 5;
  assert.throws(() => validateJournal(invalid));
  const invalidTime = structuredClone(j);
  invalidTime.events[0].quickMove.lastAt = "yesterday";
  assert.throws(() => validateJournal(invalidTime));
});
test("Calendar arithmetic crosses DST and leap days without losing dates", () => {
  assert.equal(shiftDate("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftDate("2026-03-29", 1), "2026-03-30");
});
test("Widget is real-data-only and excludes future days", () => {
  let j = event(createJournal(), 5);
  j = event(j, 50, "12:00", "2026-09-22");
  const w = widgetSnapshot(j, "2026-09-20");
  assert.equal(w.value, 1005);
  assert.equal(w.delta, 5);
});
test("Bridge hits exact anchors, is deterministic and moves around a flat segment", () => {
  const a = { t: 0, value: 1000 },
    b = { t: 60, value: 1020 };
  assert.equal(bridgeValue(a, b, 0, 5), 1000);
  assert.equal(bridgeValue(a, b, 60, 5), 1020);
  assert.equal(bridgeValue(a, b, 13, 5), bridgeValue(a, b, 13, 5));
  assert.notEqual(bridgeValue(a, { t: 60, value: 1000 }, 13, 5), 1000);
});
test("Every interval preserves real daily open/close, events and OHLC bounds", () => {
  let j = event(createJournal("Test", 1000), 20, "01:00");
  j = event(j, -7, "04:13");
  j = event(j, 3, "23:59");
  const day = calculate(j)[0];
  for (const interval of [1, 5, 15, 60, 240])
    for (const interpolate of [true, false]) {
      const c = intraday(day, interval, { interpolate });
      assert.equal(c[0].open, 1000);
      assert.equal(c.at(-1).close, 1016);
      assert.equal(c.flatMap((c) => c.events).length, 3);
      for (let i = 0; i < c.length; i++) {
        assert(c[i].high >= Math.max(c[i].open, c[i].close));
        assert(c[i].low <= Math.min(c[i].open, c[i].close));
        if (i) assert.equal(c[i].open, c[i - 1].close);
      }
      assert.equal(
        c.filter((c) => c.recorded).reduce((sum, c) => sum + c.realDelta, 0),
        16,
      );
    }
});
test("Midnight and identical minute events remain ordered and do not disappear", () => {
  let j = event(createJournal("Test", 0), 5, "00:00");
  j = event(j, -2, "00:00");
  j = event(j, 4, "00:01");
  const day = calculate(j)[0];
  const c = intraday(day, 1, { interpolate: true, until: 2 });
  assert.equal(c[0].open, 0);
  assert.equal(c[0].events.length, 2);
  assert.equal(c.at(-1).close, 7);
});
test("Intraday interpolation never changes source data or daily calculations", () => {
  const j = event(createJournal(), 2);
  const before = JSON.stringify(j),
    day = calculate(j)[0];
  intraday(day, 1);
  assert.equal(JSON.stringify(j), before);
  assert.deepEqual(calculate(j)[0], day);
});
test("Minute candles reach the exact recorded value at each recorded minute close", () => {
  let j = event(createJournal("Test", 1000), 20, "01:00");
  j = event(j, -3, "02:17");
  const day = calculate(j)[0],
    c = intraday(day, 1);
  assert.equal(c[60].close, 1020);
  assert.equal(c[137].close, 1017);
  assert.equal(c[60].events[0].after, 1020);
});
test("Five years / 18,000 events calculate within a practical time budget", () => {
  const j = createJournal();
  const stamp = new Date().toISOString();
  for (let i = 0; i < 18000; i++)
    j.events.push({
      id: "event-" + i,
      date: shiftDate("2020-01-01", Math.floor(i / 10)),
      time: "12:00",
      text: "Event",
      delta: i % 2 ? -0.1 : 0.2,
      order: i,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    });
  const start = performance.now();
  const c = calculate(validateJournal(j));
  assert.equal(c.length, 1800);
  assert.equal(c.at(-1).close, 1900);
  assert(performance.now() - start < 3000);
});
