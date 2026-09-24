import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import {
  createJournal,
  upsertEvent,
  calculate,
  validateJournal,
} from "../src/domain.mjs";
import { starterBars, STARTER_CANDLE_MINUTES } from "../src/starter.mjs";
import { minuteAt } from "../src/timeline.mjs";
import { intraday } from "../src/intraday.mjs";
import { clampDate, daysInMonth } from "../src/moment-picker.mjs";
import { chartVolume } from "../src/chart-volume.mjs";
import { COIN_COLORS, validateCoin, coinSvg } from "../src/coin.mjs";
import { themeTokens, THEME_PRESETS } from "../src/themes.mjs";
const { GraphLibrary } = createRequire(import.meta.url)(
  "../desktop/library.cjs",
);
test("starter expires after 30 creations, never pollutes totals or returns after deletion", () => {
  let j = createJournal("BTK", 1000);
  const at = minuteAt("2026-09-23", 600);
  j.settings.starter = { seed: 1234, at, remaining: 30 };
  const bars = starterBars(j, STARTER_CANDLE_MINUTES, at - 10000, at);
  assert.equal(bars.length, 30);
  assert(bars.every((bar, i) => i === 0 || bar.from - bars[i - 1].from === 60));
  assert.equal(bars.at(-1).close, 1000);
  assert.equal(calculate(j).length, 0);
  assert.deepEqual(
    starterBars(j, STARTER_CANDLE_MINUTES, at - 10000, at),
    bars,
  );
  for (let i = 0; i < 30; i++) {
    j = upsertEvent(j, {
      date: "2026-09-23",
      time: "10:00",
      text: `Event ${i}`,
      delta: 1,
    });
    assert.equal(j.settings.starter.remaining, 29 - i);
    const e = j.events.at(-1);
    j = upsertEvent(j, { ...e, text: "edited" }, e.id);
    assert.equal(j.settings.starter.remaining, 29 - i);
  }
  assert.equal(calculate(j)[0].close, 1030);
  j.events[0].deletedAt = new Date().toISOString();
  assert.equal(
    starterBars(j, STARTER_CANDLE_MINUTES, at - 10000, at).length,
    0,
  );
  assert.equal(
    validateJournal(JSON.parse(JSON.stringify(j))).settings.starter.remaining,
    0,
  );
});
test("starter remains before backdated observations and bounded above positive floor", () => {
  for (const initial of [0.01, 10, 10000]) {
    let j = createJournal("S", initial);
    const at = minuteAt("2026-09-23", 600);
    j.settings.starter = { seed: 9, at, remaining: 30 };
    j = upsertEvent(j, {
      date: "2026-09-21",
      time: "03:15",
      text: "Past",
      delta: 5,
    });
    const bars = starterBars(j, STARTER_CANDLE_MINUTES, at - 10000, at);
    assert.equal(bars.length, 29);
    assert(bars.every((c) => c.low >= 0.01 && c.events.length === 0));
    assert(bars.at(-1).to <= minuteAt("2026-09-21", 195));
    assert.equal(bars.at(-1).close, initial);
  }
});
test("rhythm levels change only drawing, event minute anchors remain exact", () => {
  let j = createJournal("R", 10000);
  j = upsertEvent(j, {
    date: "2026-09-23",
    time: "10:00",
    text: "A",
    delta: 5,
    unit: "percent",
  });
  j = upsertEvent(j, {
    date: "2026-09-23",
    time: "12:00",
    text: "B",
    delta: -10,
    unit: "percent",
  });
  const day = calculate(j)[0],
    original = JSON.stringify(day);
  for (const strength of [1, 4, 8]) {
    const bars = intraday(day, 1, { until: 900, strength });
    for (const [i, e] of [
      [600, day.events[0]],
      [720, day.events[1]],
    ]) {
      assert.equal(bars[i].open, e.before);
      assert.equal(bars[i].close, e.after);
    }
    assert.equal(bars.at(-1).close, day.close);
    assert.equal(JSON.stringify(day), original);
  }
});
test("date lists clamp month lengths and leap year", () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2025, 2), 28);
  assert.equal(clampDate(2024, 2, 31), "2024-02-29");
  assert.equal(clampDate(2025, 4, 31), "2025-04-30");
});
test("15 coin presets, validated custom color and five Unicode letters", () => {
  assert.equal(Object.keys(COIN_COLORS).length, 15);
  validateCoin({ color: "#123abc", symbol: "prism", label: "BTK" });
  assert(
    coinSvg("N", {
      color: "#123abc",
      symbol: "initials",
      label: "BTK",
    }).includes(">BTK</text>"),
  );
  assert.throws(() => validateCoin({ color: "red;bad", symbol: "prism" }));
  assert.throws(() => validateCoin({ color: "#123", symbol: "initials" }));
  assert.throws(() =>
    validateCoin({ color: "gold", symbol: "initials", label: "123456" }),
  );
  assert(
    !coinSvg("N", {
      color: "gold",
      symbol: "initials",
      label: "<svg>",
    }).includes("><SVG>"),
  );
});
test("volume uses compact histogram bars and no pyramid decoration", () => {
  const bars = [
    { date: "2026-09-23", time: "10:00", events: [{delta:1}, {delta:-2}, {delta:3}], synthetic: true },
    { date: "2026-09-23", time: "10:15", events: [], synthetic: true },
  ];
  const v = chartVolume(bars);
  assert.equal(v[0].count, 3);
  assert.ok(v[0].height > 40 && v[0].height < 50);
  assert.equal(v[1].count, 0);
  assert.ok(v[1].height > 10 && v[1].height < v[0].height);
  assert(v[1].decorative);
  assert.deepEqual(v, chartVolume(bars));
  assert.equal(
    chartVolume([{ date: "2026-09-23", events: Array(100).fill({delta:1}) }])[0].height,
    70 * 0.68,
  );
});
test("all ready themes default to green index, theme mode follows accent; custom preserved", () => {
  for (const preset of THEME_PRESETS) {
    const settings = {
      theme: preset.theme,
      appearance: { palette: preset.palette },
    };
    const classic = themeTokens(settings).tokens;
    assert.equal(classic.value, classic.up);
    assert.equal(classic.up, preset.theme === "light" ? "#087f66" : "#16c784");
    settings.appearance.chartColors = "theme";
    const themed = themeTokens(settings).tokens;
    assert.equal(themed.value, themed.accent);
    assert.equal(themed.up, themed.accent);
    assert.notEqual(themed.up, themed.down);
  }
  const colors = {
    accent: "#123456",
    up: "#234567",
    down: "#345678",
    value: "#456789",
  };
  assert.equal(
    themeTokens({ appearance: { palette: "custom", colors } }).tokens.value,
    colors.value,
  );
});
test("delete inactive/active/last graph, restart and explicit recovery preserve records", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vyshe-delete-"));
  let lib = new GraphLibrary(dir, validateJournal);
  await lib.init();
  const a = await lib.create(createJournal("A")),
    b = await lib.create(createJournal("B")),
    c = await lib.create(createJournal("C"));
  await lib.remove(b.id);
  assert.equal(lib.current.id, c.id);
  assert.equal((await lib.list()).length, 2);
  await assert.rejects(lib.open(b.id));
  await assert.rejects(lib.save(b, lib.current.revision));
  await lib.remove(c.id);
  assert.equal(lib.current.id, a.id);
  lib = new GraphLibrary(dir, validateJournal);
  await lib.init();
  assert.equal((await lib.list()).length, 1);
  await lib.remove(a.id);
  assert.equal(lib.current, null);
  lib = new GraphLibrary(dir, validateJournal);
  await lib.init();
  assert.equal(lib.current, null);
  assert.equal((await lib.list()).length, 0);
  const recovery = path.join(lib.deleted, path.basename(lib.filename(c.id)));
  const saved = JSON.parse(await fs.readFile(recovery, "utf8"));
  await lib.save(saved, 0, true);
  lib = new GraphLibrary(dir, validateJournal);
  await lib.init();
  assert.equal(lib.current.id, c.id);
  assert.equal((await lib.list()).length, 1);
});
test("interrupted deletion completes on next startup without resurrecting deleted graph", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vyshe-interrupt-"));
  let lib = new GraphLibrary(dir, validateJournal);
  await lib.init();
  const a = await lib.create(createJournal("A")),
    b = await lib.create(createJournal("B"));
  lib.reconcileDeletion = async () => {
    throw new Error("disk interrupted");
  };
  await assert.rejects(lib.remove(b.id));
  lib = new GraphLibrary(dir, validateJournal);
  await lib.init();
  assert.equal(lib.current.id, a.id);
  assert.equal((await lib.list()).length, 1);
});


test("starter starts within half to one-and-a-half base and always ends at the real base", () => {
  const at = minuteAt("2026-09-23", 600);
  const starts = new Set();
  for (const seed of [9, 1234, 900001, 3221225472, 4294967295]) {
    const journal = createJournal("Start", 100);
    journal.settings.starter = {seed, at, remaining: 30};
    const bars = starterBars(journal, 60, at - 10000, at);
    starts.add(bars[0].open);
    assert.ok(bars.every(bar => bar.low >= 50 && bar.high <= 150));
    assert.equal(bars.at(-1).close, 100);
    assert.equal(journal.settings.initial, 100);
    assert.equal(journal.events.length, 0);
  }
  assert.equal(starts.size, 5);
});
