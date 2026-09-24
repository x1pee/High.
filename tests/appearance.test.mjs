import test from "node:test";
import assert from "node:assert/strict";
import {
  createJournal,
  validateJournal,
  upsertEvent,
  upsertDay,
  calculate,
  widgetSnapshot,
} from "../src/domain.mjs";
import {
  THEME_PRESETS,
  themeTokens,
  COLOR_KEYS,
  contrastRatio,
} from "../src/themes.mjs";

test("legacy journals remain valid and system appearance follows the OS", () => {
  const legacy = createJournal();
  assert.equal(validateJournal(legacy).settings.appearance, undefined);
  assert.equal(themeTokens({ theme: "system" }, false).mode, "light");
  assert.equal(themeTokens({ theme: "system" }, true).mode, "dark");
});
test("ready palettes preserve readable controls and chart colors in both modes", () => {
  for (const p of THEME_PRESETS)
    for (const theme of ["light", "dark"]) {
      const { tokens: t } = themeTokens({
        theme,
        appearance: { palette: p.palette },
      });
      assert(contrastRatio(t.text, t.surface) >= 7);
      assert(contrastRatio(t.accent, t["accent-ink"]) >= 4.5);
      assert(contrastRatio(t.value, t["value-ink"]) >= 4.5);
      for (const k of COLOR_KEYS)
        assert(contrastRatio(t[k], t.surface) >= 3, `${p.id} ${theme} ${k}`);
    }
});
test("import rejects invalid custom colors and retains complete valid appearance", () => {
  const j = createJournal();
  for (const a of [
    { palette: "unknown" },
    { palette: "custom" },
    { palette: "custom", colors: { accent: "url(x)" } },
    { palette: "blue", colors: [] },
  ]) {
    j.settings.appearance = a;
    assert.throws(() => validateJournal(j));
  }
  j.settings.appearance = {
    palette: "custom",
    colors: {
      accent: "#2468ab",
      up: "#35caa2",
      down: "#ee7186",
      value: "#9876ef",
    },
  };
  assert.deepEqual(
    validateJournal(j).settings.appearance,
    j.settings.appearance,
  );
});
test("mobile JSON roundtrip preserves unicode, local coordinates, tombstones and appearance", () => {
  let j = createJournal("MAXCOIN · Мой путь", 10, "light");
  j.settings.appearance = { palette: "amber" };
  j = upsertEvent(j, {
    date: "2026-09-23",
    time: "09:01",
    text: "Прогулка 💎",
    delta: 1.5,
  });
  j = upsertEvent(j, {
    date: "2026-09-23",
    time: "09:01",
    text: "Удалённая запись",
    delta: -2,
  });
  j.events[1].deletedAt = j.events[1].updatedAt;
  j = upsertDay(j, {
    date: "2026-09-23",
    title: "Мой день",
    note: "Вверх и вниз",
  });
  const transferred = validateJournal(JSON.parse(JSON.stringify(j)));
  assert.deepEqual(transferred, j);
  assert.deepEqual(calculate(transferred), calculate(j));
  assert.deepEqual(
    widgetSnapshot(transferred, "2026-09-23"),
    widgetSnapshot(j, "2026-09-23"),
  );
});
