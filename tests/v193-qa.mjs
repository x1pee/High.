import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {
  calculate,
  createJournal,
  upsertEvent,
  localDate,
  shiftDate,
} from "../src/domain.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work");
const dir = await fs.mkdtemp(path.join(work, "v193-profile-")),
  shots = path.join(work, "v193-qa");
await fs.mkdir(shots, { recursive: true });
let journal = createJournal("MAXCOIN", 10000);
for (let d = 39; d >= 0; d--)
  for (let k = 0; k < 2; k++)
    journal = upsertEvent(journal, {
      date: shiftDate(localDate(), -d),
      time: d === 0 ? (k ? "00:05" : "00:00") : k ? "16:30" : "08:00",
      text: k ? "Прогулка с близким человеком" : "Закончил важную задачу",
      delta: 10 * (k ? (d % 3 ? -8 : 12) : d % 4 ? 20 : -14),
    });
await fs.writeFile(path.join(dir, "journal.json"), JSON.stringify(journal));
const launch = () =>
  electron.launch({
    executablePath: process.env.VYSHE_TEST_EXE,
    args: process.env.VYSHE_TEST_EXE ? [] : [root],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined,
      VYSHE_DATA_DIR: dir,
    },
  });
let app = await launch(),
  p = await app.firstWindow();
const errors = [];
function attach() {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept().catch(() => {}));
}
attach();
const snapshot = () =>
  p.evaluate(async () => JSON.stringify((await window.desktop.load()).journal));
const point = async (n = -8) => {
  const bodies = p.locator(".chart-candle .candle-body");
  const box = await bodies
    .nth(n < 0 ? (await bodies.count()) + n : n)
    .boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
async function shot(name) {
  await p.mouse.move(8, 30);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() =>
    Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    ),
  );
  await p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const img = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
      .toPNG()
      .toString("base64"),
  );
  await fs.writeFile(
    path.join(shots, name + ".png"),
    Buffer.from(img, "base64"),
  );
}
async function settings() {
  await p.locator("#settings").click();
  await p.locator('[data-settings-tab="general"]').click();
}
async function saveSettings() {
  await p.locator('#settings-form [type="submit"]').click();
  await p.waitForSelector("dialog", { state: "detached" });
}
try {
  await p.waitForSelector(".chart-candle .candle-body");
  assert.equal(await p.locator("#today").innerText(), "Сегодня");
  assert.equal(await p.locator(".local-indicator svg").count(), 0);
  assert.equal(await p.locator("#panel-corner").innerText(), "");
  // A minute window after the last record keeps the known price visible.
  await p.locator('[data-interval="1"]').click();
  assert.equal(await p.locator("#chart-empty").isVisible(), false);
  assert((await p.locator(".chart-candle,.gap-candle").count()) > 0);
  const mid = p
    .locator('.chart-candle[data-recorded="false"] .candle-body')
    .nth(30);
  await mid.hover();
  await p.waitForSelector("#hover-card");
  assert((await p.locator(".focused-candle").count()) > 1);
  assert.equal(await p.locator("#hover-card .hover-delta").isVisible(), false);
  assert.equal(await p.locator("#focus-candle .crosshair").count(), 0);
  await p.keyboard.press("Escape");
  await p.mouse.move(8, 30);
  // Advancing the clock follows the live edge but never steals a historical view.
  const now = new Date();

  const before = await p.locator("#range-label").innerText();
  await p.clock.setSystemTime(new Date(now.getTime() + 120000));
  await p.waitForTimeout(1200);
  const after = await p.locator("#range-label").innerText();
  assert.notEqual(after, before, "live range advances");
  await p.locator("#previous").click();
  const history = await p.locator("#range-label").innerText();
  await p.clock.setSystemTime(new Date(now.getTime() + 240000));
  await p.waitForTimeout(1200);
  assert.equal(
    await p.locator("#range-label").innerText(),
    history,
    "historical range is stable",
  );
  await p.locator("#today").click();
  await p.locator('[data-interval="1440"]').click();
  // Preserve selection after adding a backdated event; newest creation stays on top.
  await settings();
  await p.locator('[name="followEvent"]').uncheck();
  await p.locator('[data-coin-color="red"]').click();
  await p.locator('[data-coin-symbol="compass"]').click();
  await p.locator('[data-coin-rim="segments"]').click();
  await p.locator('[name="coinLabel"]').fill("Я★");
  await shot("coin");
  await saveSettings();
  const oldDate = shiftDate(localDate(), -3);
  await p.locator("#selected-date").fill(oldDate);
  await p.locator("#selected-date").dispatchEvent("change");
  const oldRange = await p.locator("#range-label").innerText();
  await p.locator("#add-event").click();
  await p.locator('#event-form [name="text"]').fill("Новая запись сегодня");
  await p.locator('[data-delta-sign="-1"]').click();
  assert.equal(await p.locator('[name="delta"]').inputValue(), "-5");
  await p.locator('[data-unit="percent"]').click();
  await p.locator('[name="delta"]').fill("-120");
  const unchanged = await snapshot();
  await p.locator('#event-form [type="submit"]').click();
  assert((await p.locator(".form-error").innerText()).includes("0,01"));
  assert.equal(await snapshot(), unchanged, "rejected loss does not persist");
  await shot("event-form");
  await p.locator('[name="delta"]').fill("-5");
  await p.locator('#event-form [type="submit"]').click();
  await p.waitForSelector("dialog", { state: "detached" });
  assert.equal(await p.locator("#selected-date").inputValue(), oldDate);
  assert.equal(await p.locator("#range-label").innerText(), oldRange);
  await p.locator("#today").click();
  assert(
    (await p.locator(".day-events .event-row").first().innerText()).includes(
      "Новая запись сегодня",
    ),
  );
  await p.locator("#add-selected").click();
  await p
    .locator('#event-form [name="text"]')
    .fill("Самая новая, раннее время");
  await p.locator('[data-event-time="custom"]').click();
  await p.locator('[data-time-hour="00"]').click();
  await p.locator('[name="pickMinute"]').evaluate((input) => { input.value = "1"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  await p.locator('#event-form [type="submit"]').click();
  await p.waitForSelector("dialog", { state: "detached" });
  assert(
    (await p.locator(".day-events .event-row").first().innerText()).includes(
      "Самая новая, раннее время",
    ),
  );
  await shot("chart");
  // Long day note must scroll without moving the pin / open / OHLC actions.
  await p.locator("#edit-day").click();
  await p.locator('#day-form [name="title"]').fill("Длинный день");
  await p
    .locator('#day-form [name="note"]')
    .fill("Подробности важного дня. ".repeat(100));
  await p.locator('#day-form [type="submit"]').click();
  await p.waitForSelector("dialog", { state: "detached" });
  const candle = await point(-1);
  await p.mouse.move(candle.x, candle.y);
  await p.waitForSelector("#hover-card");
  const title = await p.locator("#hover-card h3").innerText();
  const card = await p.locator("#hover-card").boundingBox();
  await p.mouse.move(card.x + card.width / 2, card.y + card.height / 2, {
    steps: 25,
  });
  assert.equal(
    await p.locator("#hover-card h3").innerText(),
    title,
    "travel to card must not change candle",
  );
  const bounds = await p.locator("#hover-card").evaluate((e) => {
    const c = e.getBoundingClientRect(),
      actions = ["#pin-hover", "#open-hover-day", ".hover-ohlc"].map((s) =>
        e.querySelector(s).getBoundingClientRect(),
      );
    return actions.every((a) => a.top >= c.top && a.bottom <= c.bottom);
  });
  assert(bounds, "all card actions and extrema visible above long text");
  await p.mouse.wheel(0, 200);
  await p.waitForFunction(() => document.querySelector(".hover-scroll")?.scrollTop > 0);
  await p.locator("#pin-hover").click();
  await shot("card");
  await p.locator("#open-hover-day").click();
  await p.waitForSelector(".day-detail-modal");
  assert.equal(
    await p.locator(".day-detail-modal h2").innerText(),
    "Длинный день",
  );
  assert((await p.locator(".day-detail-events .event-row").count()) >= 4);
  await p.locator(".modal-close").click();
  // Panning hides cards throughout pointer capture.
  const q = await point(-10);
  await p.mouse.move(q.x, q.y);
  await p.mouse.down();
  await p.mouse.move(q.x + 100, q.y, { steps: 12 });
  assert.equal(await p.locator("#hover-card").count(), 0);
  await p.mouse.up();
  // Baseline is a genuine split color path, selectable from the style menu.
  await p.locator('[data-chart-style="candles"]').click();
  await p.locator('[data-style-option="baseline"]').click();
  assert.equal(
    await p.locator("#chart").getAttribute("data-style"),
    "baseline",
  );
  assert.equal(await p.locator("#above-base").count(), 1);
  assert.equal(await p.locator("#below-base").count(), 1);
  await shot("baseline");
  const saved = JSON.parse(await snapshot());
  assert.deepEqual(saved.settings.coin, {
    color: "red",
    symbol: "compass",
    rim: "segments",
    label: "Я★",
  });
  assert.equal(saved.settings.followEvent, false);
  await app.close();
  app = await launch();
  p = await app.firstWindow();
  attach();
  await p.waitForSelector(".instrument-coin svg");
  assert.equal(JSON.parse(await snapshot()).settings.followEvent, false);
  assert.deepEqual(
    JSON.parse(await snapshot()).settings.coin,
    saved.settings.coin,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "V193 QA PASS: signed visible input, floor/no writes, newest backdated first, retained selection, live/historical clock, continuous minute chart, grouped gap, card travel/scroll/actions, full day, drag, baseline, coin/settings persistence",
  );
} catch (error) {
  console.log("UI errors", errors);
  await shot("failure");
  throw error;
} finally {
  await app.close();
}
