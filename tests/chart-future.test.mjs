import test from "node:test";
import assert from "node:assert/strict";
import { appendFutureBars } from "../src/chart-future.mjs";
import { minuteAt } from "../src/timeline.mjs";

test("future chart extension adds flat, unrecorded bars after observations", () => {
  const observedEnd = minuteAt("2026-09-25", 10 * 60 + 30);
  const bars = [{ to: observedEnd, close: 42 }];
  const result = appendFutureBars(
    bars,
    observedEnd - 60,
    observedEnd + 45,
    observedEnd,
    15,
    0,
  );

  assert.equal(result.length, 4);
  assert.equal(result[0], bars[0]);
  assert.deepEqual(
    result.slice(1).map(({ time, endTime, open, close, recorded }) => ({
      time,
      endTime,
      open,
      close,
      recorded,
    })),
    [
      { time: "10:30", endTime: "10:45", open: 42, close: 42, recorded: false },
      { time: "10:45", endTime: "11:00", open: 42, close: 42, recorded: false },
      { time: "11:00", endTime: "11:15", open: 42, close: 42, recorded: false },
    ],
  );
  assert.deepEqual(result.slice(1).flatMap((bar) => bar.events), []);
});

test("a viewport wholly in the future is filled without inventing observations", () => {
  const observedEnd = minuteAt("2026-09-25", 10 * 60 + 30);
  const result = appendFutureBars(
    [],
    observedEnd + 30,
    observedEnd + 60,
    observedEnd,
    15,
    17,
  );

  assert.deepEqual(result.map((bar) => bar.close), [17, 17]);
  assert.ok(result.every((bar) => !bar.recorded && !bar.synthetic && !bar.events.length));
});
