import test from "node:test";
import assert from "node:assert/strict";
import {
  createJournal,
  upsertEvent,
  calculate,
  validateJournal,
} from "../src/domain.mjs";
import { assertPriceChange } from "../src/price-policy.mjs";
import { timeline, minuteAt } from "../src/timeline.mjs";
import { bridgeValue } from "../src/intraday.mjs";
import { coinSvg, COIN_RIMS, COIN_COLORS, COIN_SYMBOLS } from "../src/coin.mjs";
const date = "2026-09-20";
const add = (j, delta, unit = "points", time = "10:00") =>
  upsertEvent(j, { date, time, text: "Запись", delta, unit });
test("price policy rejects new deficits, full percentage loss and unsafe historical rebase", () => {
  const j = createJournal("Цена", 100);
  for (const [n, u] of [
    [-120, "percent"],
    [-100, "percent"],
    [-100, "points"],
  ])
    assert.throws(() => assertPriceChange(j, add(j, n, u)), /0,01/);
  assert.doesNotThrow(() => assertPriceChange(j, add(j, -99.99)));
  assert.doesNotThrow(() => assertPriceChange(j, add(j, 200, "percent")));
  let n = add(j, -80);
  n = add(n, -50, "percent", "11:00");
  const rebased = structuredClone(n);
  rebased.settings.initial = 50;
  assert.throws(() => assertPriceChange(n, rebased), /0,01/);
  assert.throws(() => assertPriceChange(null, createJournal("zero", 0)));
});
test("legacy negative history stays exact, can be repaired, cannot be deepened", () => {
  const bad = add(createJournal("Старая история", 100), -120, "percent");
  assert.equal(calculate(validateJournal(bad))[0].close, -20);
  assert.doesNotThrow(() => assertPriceChange(bad, structuredClone(bad)));
  const repair = upsertEvent(
    bad,
    { ...bad.events[0], delta: -90 },
    bad.events[0].id,
  );
  assert.doesNotThrow(() => assertPriceChange(bad, repair));
  const worse = upsertEvent(
    bad,
    { ...bad.events[0], delta: -130 },
    bad.events[0].id,
  );
  assert.throws(() => assertPriceChange(bad, worse));
  const removed = structuredClone(bad);
  removed.events[0].deletedAt = new Date().toISOString();
  assert.doesNotThrow(() => assertPriceChange(bad, removed));
});
test("minute history remains visible after last event, never invents events before history", () => {
  const j = add(createJournal("Индекс", 100), 5),
    d = calculate(j),
    origin = minuteAt(date);
  const bars = timeline(
    d,
    100,
    1,
    origin + 12 * 60,
    origin + 13 * 60,
    true,
    origin + 14 * 60,
  );
  assert.equal(bars.length, 60);
  assert(bars.every((b) => !b.recorded && !b.events.length));
  assert.equal(
    bars.reduce((n, b) => n + b.realDelta, 0),
    0,
  );
  assert.deepEqual(timeline(d, 100, 1, origin, origin + 60), []);
  const later = timeline(d, 100, 1, origin + 2 * 1440, origin + 2 * 1440 + 60);
  assert.equal(later.length, 60);
  assert(later.every((b) => !b.recorded && !b.events.length && b.realDelta === 0));
  assert(later.some((b) => b.close !== b.open));
  assert.equal(later[0].open, 105);
  assert.equal(later.at(-1).close, 105);
});
test("visual rhythm never crosses positive floor near zero", () => {
  for (let t = 0; t <= 100; t += 0.25)
    assert(
      bridgeValue({ t: 0, value: 0.01 }, { t: 100, value: 0.01 }, t, 17) >=
        0.01,
    );
});
test("all coin combinations and custom unicode labels roundtrip safely", () => {
  const j = createJournal();
  for (const color of Object.keys(COIN_COLORS))
    for (const symbol of Object.keys(COIN_SYMBOLS))
      for (const rim of Object.keys(COIN_RIMS)) {
        j.settings.coin = { color, symbol, rim, label: "Я★" };
        const coin = validateJournal(j).settings.coin;
        assert.equal(coinSvg("Test", coin).includes("undefined"), false);
      }
  j.settings.coin = { color: "red", symbol: "initials", label: "<>" };
  assert(coinSvg("x", j.settings.coin).includes("&lt;&gt;"));
  j.settings.coin.rim = "__proto__";
  assert.throws(() => validateJournal(j));
});
