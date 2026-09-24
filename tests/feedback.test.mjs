import test from "node:test";
import assert from "node:assert/strict";
import { intraday } from "../src/intraday.mjs";
import {
  EVENT_EXAMPLES,
  EXAMPLE_CATEGORIES,
  findExamples,
} from "../src/event-examples.mjs";
import { themeTokens } from "../src/themes.mjs";
test("empty and note-only days never create interpolated observations", () => {
  for (const recorded of [false, true])
    for (const interval of [1, 5, 15, 60, 240])
      for (const interpolate of [true, false]) {
        assert.deepEqual(
          intraday(
            {
              date: "2026-09-23",
              open: 1000,
              close: 1000,
              events: [],
              recorded,
              note: "День без событий",
            },
            interval,
            { interpolate },
          ),
          [],
        );
      }
});
test("500 unique suggestions carry no scores and support search and categories", () => {
  assert.equal(EVENT_EXAMPLES.length, 500);
  assert.equal(new Set(EVENT_EXAMPLES.map((e) => e.text)).size, 500);
  assert.equal(EXAMPLE_CATEGORIES.length, 10);
  assert(EVENT_EXAMPLES.every((e) => !("delta" in e)));
  assert(!EVENT_EXAMPLES.some((e) => e.text === "Сменил постельное бельё"));
  assert(EVENT_EXAMPLES.some((e) => e.text === "Навёл порядок в шкафу"));
  assert.equal(findExamples(" ЗАРПЛАТУ ")[0].text, "Получил зарплату");
  assert.equal(findExamples("", "Отдых").length, 50);
  assert.equal(findExamples("несуществующийпример").length, 0);
});
test("default is neutral midnight with amber accents and forest retains neutral surfaces", () => {
  const basic = themeTokens().tokens;
  const forest = themeTokens({
    theme: "dark",
    appearance: { palette: "green" },
  }).tokens;
  assert.equal(basic.accent, "#f7a924");
  for (const key of [
    "bg",
    "surface",
    "surface-raised",
    "surface-hover",
    "grid",
    "line",
  ])
    assert.equal(forest[key], basic[key]);
  assert.equal(forest.up, "#16c784");
  assert.equal(forest.down, "#f6465d");
});
