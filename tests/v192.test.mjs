import test from "node:test";
import assert from "node:assert/strict";
import { parseSignedInput } from "../src/signed-input.mjs";
import { coinSvg, COIN_COLORS, COIN_SYMBOLS } from "../src/coin.mjs";
import { createJournal, validateJournal } from "../src/domain.mjs";
import { hitCandle } from "../src/chart-view.mjs";
import { momentRun } from "../src/chart-context.mjs";

test("sign selector supports decimal comma, explicit signs, zero and rejects malformed weights", () => {
  assert.deepEqual(parseSignedInput("65", -1), { value: -65, sign: -1 });
  assert.deepEqual(parseSignedInput("-1,96", 1), { value: -1.96, sign: -1 });
  assert.deepEqual(parseSignedInput("+5", -1), { value: 5, sign: 1 });
  assert.deepEqual(parseSignedInput("−0", -1), { value: 0, sign: 1 });
  for (const raw of [
    "",
    "-",
    "NaN",
    "1e3",
    "1.234",
    "12abc",
    "1,2.3",
    "10000001",
  ])
    assert.throws(() => parseSignedInput(raw));
});
test("coin choices survive JSON validation and hostile names are escaped", () => {
  const j = createJournal("<x");
  assert.doesNotThrow(() => validateJournal(j));
  for (const color of Object.keys(COIN_COLORS))
    for (const symbol of Object.keys(COIN_SYMBOLS)) {
      j.settings.coin = { color, symbol };
      assert.deepEqual(
        validateJournal(JSON.parse(JSON.stringify(j))).settings.coin,
        { color, symbol },
      );
      assert(!coinSvg(j.settings.name, j.settings.coin).includes("<X"));
    }
  for (const coin of [
    null,
    { color: "__proto__", symbol: "star" },
    { color: "gold", symbol: "<img>" },
  ]) {
    j.settings.coin = coin;
    assert.throws(() => validateJournal(j));
  }
});
test("thin candles have forgiving hit area but distant empty chart still misses", () => {
  const g = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: 200,
    height: 200,
    step: 40,
    bw: 3,
    x: (i) => 20 + i * 40,
    y: (n) => 200 - n,
  };
  const c = {
    intraday: true,
    recorded: true,
    open: 100,
    close: 100.01,
    high: 100.01,
    low: 100,
  };
  assert.equal(hitCandle([c], g, "candles", 20, 92), 0);
  assert.equal(hitCandle([c], g, "candles", 20, 70), null);
  assert.equal(hitCandle([c, { ...c }], g, "candles", 60, 99), 1);
  const gap = { ...c, recorded: false, synthetic: false };
  assert.equal(hitCandle([gap], g, "candles", 20, 99), null);
  assert.equal(hitCandle([gap], g, "candles", 20, 99, 5, true), 0);
});
test("grouped interval crosses neutral gaps, stops at real events, clips to viewport", () => {
  const gap = { intraday: true, recorded: false, synthetic: false };
  const event = { ...gap, recorded: true };
  const bars = [event, gap, { ...gap, synthetic: true }, gap, event, gap, gap];
  for (const i of [1, 2, 3]) assert.deepEqual(momentRun(bars, i), [1, 3]);
  assert.deepEqual(momentRun(bars, 5), [5, 6]);
  assert.deepEqual(momentRun(bars.slice(2, 4), 0), [0, 1]);
  assert.deepEqual(momentRun(bars, 4), [4, 4]);
});
