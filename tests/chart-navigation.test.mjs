import test from "node:test";
import assert from "node:assert/strict";
import {
  captureLogicalRange, logicalToTime, panLogicalRange,
  timeToLogical, zoomLogicalRange,
} from "../src/chart-navigation.mjs";
import { shiftPriceRange } from "../src/chart-view.mjs";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const pixelAt = (range, value, width = 1200) =>
  (value - range.from) / (range.to - range.from) * width;

test("a fractional plot drag moves candles exactly with the pointer without rounding or changing spacing", () => {
  const origin = { from: 1234.25, to: 1334.25 };
  for (const dx of [0.25, 2, 37.6, -48.5, 755, -1700]) {
    const moved = panLogicalRange(origin, dx, 1200);
    close(pixelAt(moved, 1290) - pixelAt(origin, 1290), dx);
    close(moved.to - moved.from, origin.to - origin.from);
  }
  assert.deepEqual(panLogicalRange(origin, 0, 1200), origin);
});

test("cursor-anchored wheel scale keeps the same logical candle under the cursor at all zoom limits", () => {
  const origin = { from: 200, to: 400 };
  for (const ratio of [0, 0.13, 0.5, 0.99, 1]) {
    const anchor = origin.from + 200 * ratio;
    for (const factor of [0.0001, 0.8, 1.2, 100]) {
      const scaled = zoomLogicalRange(origin, factor, ratio, 3, 2400);
      close(pixelAt(scaled, anchor), ratio * 1200);
      assert.ok(scaled.to - scaled.from >= 3 - 1e-7);
      assert.ok(scaled.to - scaled.from <= 2400 + 1e-7);
    }
  }
});

test("capturing a compact initial history preserves its existing pixel spacing and right offset", () => {
  const range = captureLogicalRange(1000.5, 850, 20, 1000, 20);
  close(pixelAt(range, 1000.5, 1000), 830);
  close((range.to - range.from), 50);
});

test("month, quarter and year coordinates stay uniformly spaced across short months and leap years", () => {
  for (const interval of [1, 15, 1440, 10080, 43200, 129600, 525600]) {
    for (const iso of ["2024-02-29T23:30:00Z", "2026-10-22T12:12:00Z", "2030-01-01T00:00:00Z"]) {
      const minute = Date.parse(iso) / 60000;
      close(logicalToTime(timeToLogical(minute, interval), interval), minute);
    }
  }
  const jan = timeToLogical(Date.parse("2024-01-01T00:00:00Z") / 60000, 43200);
  const feb = timeToLogical(Date.parse("2024-02-01T00:00:00Z") / 60000, 43200);
  const mar = timeToLogical(Date.parse("2024-03-01T00:00:00Z") / 60000, 43200);
  assert.equal(feb - jan, 1);
  assert.equal(mar - feb, 1);
});

test("manual vertical dragging follows both signs pixel for pixel from a frozen origin", () => {
  const origin = { low: 90, high: 110 };
  const y = (range, price) => (range.high - price) / (range.high - range.low) * 400;
  for (const dy of [-400, -0.5, 0.25, 100]) {
    const moved = shiftPriceRange(origin, dy, 400);
    close(y(moved, 100) - y(origin, 100), dy);
  }
});
