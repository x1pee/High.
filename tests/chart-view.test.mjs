import test from "node:test";
import assert from "node:assert/strict";
import {
  chartIndexAtTime,
  chartTimeAtIndex,
  heikinAshi,
  hitCandle,
  scalePriceRange,
  shiftPriceRange,
} from "../src/chart-view.mjs";
import { movingAverage } from "../src/timeline.mjs";
const g = {
  left: 10,
  right: 10,
  top: 10,
  bottom: 10,
  width: 210,
  height: 210,
  step: 40,
  bw: 16,
  x: (i) => 30 + i * 40,
  y: (n) => 200 - n,
};
const bars = [
  { open: 80, close: 100, high: 130, low: 50, recorded: true },
  { open: 100, close: 120, high: 140, low: 80, recorded: true },
];
test("pointer selection follows body and wick, never the empty time column or gap", () => {
  for (const style of ["candles", "hollow", "heikin", "bars"]) {
    assert.equal(hitCandle(bars, g, style, 30, 110), 0);
    assert.equal(hitCandle(bars, g, style, 32, 73), 0);
    assert.equal(hitCandle(bars, g, style, 30, 185), null);
    assert.equal(hitCandle(bars, g, style, 45, 73), null);
    assert.equal(hitCandle(bars, g, style, 30, 6), null);
  }
  assert.equal(hitCandle(bars, g, "candles", 42, 110), 0);
  assert.equal(hitCandle(bars, g, "candles", 46, 110), null);
  assert.equal(
    hitCandle([{ ...bars[0], recorded: false }], g, "candles", 30, 110),
    null,
  );
  assert.equal(
    hitCandle(
      [{ ...bars[0], recorded: false, synthetic: true }],
      g,
      "candles",
      30,
      110,
    ),
    0,
  );
});
test("line chart hit testing follows the line, not the filled area below it", () => {
  assert.equal(hitCandle(bars, g, "line", 50, 90), 0);
  assert.equal(hitCandle(bars, g, "line", 50, 170), null);
  assert.equal(hitCandle(bars, g, "line", 65, 83), 1);
});
test("Heikin Ashi uses recursive OHLC, preserves raw events and resets on missing observations", () => {
  const source = JSON.stringify(bars),
    ha = heikinAshi(bars);
  assert.deepEqual(
    [ha[0].open, ha[0].close, ha[0].high, ha[0].low],
    [90, 90, 130, 50],
  );
  assert.deepEqual(
    [ha[1].open, ha[1].close, ha[1].high, ha[1].low],
    [90, 110, 140, 80],
  );
  assert.equal(JSON.stringify(bars), source);
  const gap = { open: 120, close: 120, high: 120, low: 120, recorded: false };
  assert.deepEqual(heikinAshi([...bars, gap])[2], gap);
  assert.equal(heikinAshi([...bars, gap, bars[0]])[3].open, 90);
});
test("7/14/28 averages and bounded HA warmup match the existing history", () => {
  const history = Array.from({ length: 250 }, (_, i) => ({
    open: 1000 + i,
    close: 1002 + i,
    high: 1005 + i,
    low: 990 + i,
    recorded: true,
  }));
  for (const length of [7, 14, 28]) {
    const avg = movingAverage(history, length);
    assert.equal(avg[length - 2], null);
    assert.equal(avg[length - 1], 1002 + (length - 1) / 2);
    assert.deepEqual(
      movingAverage(history.slice(100 - length), length).slice(length),
      avg.slice(100),
    );
  }
  assert.deepEqual(
    heikinAshi(history.slice(4)).slice(96),
    heikinAshi(history).slice(100),
  );
});

test("compact right-aligned candles use their own origin; removed event dots are not hit targets", () => {
  const compact = { ...g, candleLeft: 130, step: 30, x: (i) => 145 + i * 30 };
  assert.equal(hitCandle(bars, compact, "candles", 145, 110), 0);
  assert.equal(hitCandle(bars, compact, "candles", 175, 90), 1);
  assert.equal(hitCandle(bars, compact, "candles", 50, 110), null);
  const observed = [{ ...bars[0], intraday: true }];
  assert.equal(
    hitCandle(observed, g, "candles", 30, g.y(bars[0].high) - 7),
    null,
  );
});

test("manual price panning shifts the range with the pointer and ignores invalid geometry", () => {
  assert.deepEqual(shiftPriceRange({ low: 10, high: 30 }, 25, 100), {
    low: 15,
    high: 35,
  });
  assert.deepEqual(shiftPriceRange({ low: 10, high: 30 }, -25, 100), {
    low: 5,
    high: 25,
  });
  const range = { low: 10, high: 30 };
  assert.equal(shiftPriceRange(range, 10, 0), range);
});

test("vertical scale zoom keeps the value under the pointer anchored", () => {
  assert.deepEqual(scalePriceRange({ low: 10, high: 30 }, 2, 0.5), {
    low: 0,
    high: 40,
  });
  assert.deepEqual(scalePriceRange({ low: 10, high: 30 }, 2, 0), {
    low: -10,
    high: 30,
  });
  assert.deepEqual(scalePriceRange({ low: 10, high: 30 }, 0.5, 0.5), {
    low: 15,
    high: 25,
  });
  const range = { low: 10, high: 30 };
  assert.equal(scalePriceRange(range, 0, 0.5), range);
});

test("drawing time maps interpolate real candle gaps and extrapolate into the future", () => {
  const times = [100, 200, 500];
  assert.equal(chartIndexAtTime(times, 350), 1.5);
  assert.equal(chartTimeAtIndex(times, 1.5), 350);
  assert.equal(chartIndexAtTime(times, 650), 2.5);
  assert.equal(chartTimeAtIndex(times, 2.5), 650);
  assert.equal(chartIndexAtTime(times, 50), -0.5);
});
