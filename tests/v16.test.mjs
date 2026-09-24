import test from "node:test";
import assert from "node:assert/strict";
import { createJournal, upsertEvent, calculate } from "../src/domain.mjs";
import { calendarBars, periodStart } from "../src/calendar-bars.mjs";
import {
  EVENT_EXAMPLES,
  shuffledExamples,
  findExamples,
} from "../src/event-examples.mjs";

test("calendar boundaries: Monday, leap month, quarter and year", () => {
  assert.equal(periodStart("2026-09-27", 10080), "2026-09-21");
  assert.equal(periodStart("2026-09-28", 10080), "2026-09-28");
  assert.equal(periodStart("2024-02-29", 43200), "2024-02-01");
  assert.equal(periodStart("2026-09-23", 129600), "2026-07-01");
  assert.equal(periodStart("2026-12-31", 525600), "2026-01-01");
});
test("aggregate OHLC includes all events once, exact closes and no future", () => {
  let j = createJournal("Test", 1000);
  for (const [date, delta] of [
    ["2024-02-28", 10],
    ["2024-02-29", -20],
    ["2024-03-01", 30],
    ["2024-04-01", 5],
    ["2025-01-01", -10],
  ])
    j = upsertEvent(j, { date, delta, text: date, time: "12:00" });
  const days = calculate(j),
    source = JSON.stringify(days);
  for (const interval of [1440, 10080, 43200, 129600, 525600]) {
    const bars = calendarBars(days, 1000, "2024-02-28", "2025-01-01", interval);
    assert.equal(bars[0].open, 1000);
    assert.equal(bars.at(-1).close, 1015);
    assert.equal(Math.max(...bars.map((b) => b.high)), 1025);
    assert.equal(Math.min(...bars.map((b) => b.low)), 990);
    assert.equal(bars.flatMap((b) => b.events).length, 5);
    assert(bars.every((b) => (b.endDate ?? b.date) <= "2025-01-01"));
    for (let i = 1; i < bars.length; i++)
      assert.equal(bars[i].open, bars[i - 1].close);
  }
  const feb = calendarBars(days, 1000, "2024-02-29", "2024-03-01", 43200)[0];
  assert.equal(feb.date, "2024-02-01");
  assert.equal(feb.close, 990);
  assert.equal(feb.events.length, 2);
  assert.equal(JSON.stringify(days), source);
});
test("catalogue shuffle preserves all 500 prompts and changes the first without mutating source", () => {
  const original = JSON.stringify(EVENT_EXAMPLES);
  const a = shuffledExamples(() => 0.5),
    b = shuffledExamples(() => 0.5);
  assert.equal(new Set(a.map((e) => e.text)).size, 500);
  assert.notEqual(a[0].text, b[0].text);
  assert.deepEqual(
    findExamples("", "Дом", a),
    a.filter((e) => e.category === "Дом"),
  );
  assert.equal(JSON.stringify(EVENT_EXAMPLES), original);
});
