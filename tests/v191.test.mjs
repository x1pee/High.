import test from "node:test";
import assert from "node:assert/strict";
import { EVENT_EXAMPLES, shuffledExamples } from "../src/event-examples.mjs";
import { CHART_PHRASES, nextChartPhrase } from "../src/chart-phrases.mjs";
import { candlePriceRange } from "../src/chart-view.mjs";

test("each placeholder stays outside the first ten ideas, including repeated shuffles", () => {
  for (const e of EVENT_EXAMPLES) {
    for (let n = 0; n < 2; n++) {
      const ideas = shuffledExamples(() => 0.99999, e.text);
      assert.equal(ideas.length, 500);
      assert.equal(new Set(ideas.map((i) => i.text)).size, 500);
      assert(!ideas.slice(0, 10).some((i) => i.text === e.text));
    }
  }
});
test("twenty distinct chart phrases never immediately repeat", () => {
  assert.equal(new Set(CHART_PHRASES).size, 20);
  for (const phrase of CHART_PHRASES) {
    assert.notEqual(
      nextChartPhrase(phrase, () => 0),
      phrase,
    );
    assert.notEqual(
      nextChartPhrase(phrase, () => 0.99999),
      phrase,
    );
  }
});
test("price fitting preserves extrema, uses most of plot, handles flat/negative/empty ranges", () => {
  for (const [low, high] of [
    [9000, 15000],
    [-300, -100],
    [-10, 10],
    [100, 100.01],
  ]) {
    const r = candlePriceRange([{ low, high }]);
    assert(r.low < low && r.high > high);
    if (high - low > 1) assert((high - low) / (r.high - r.low) > 0.88);
  }
  for (const value of [0, 1000, -1000]) {
    const r = candlePriceRange([{ low: value, high: value }]);
    assert(Number.isFinite(r.low) && r.low < value && r.high > value);
  }
  assert.deepEqual(candlePriceRange([]), { low: -1, high: 1 });
});
