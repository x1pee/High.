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
const dir = await fs.mkdtemp(path.join(work, "v192-profile-")),
  shots = path.join(work, "v192-qa");
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
try {
  await p.waitForSelector(".chart-candle");
  assert.equal(
    await p.locator("#group-moments").getAttribute("aria-pressed"),
    "true",
  );
  const original = JSON.parse(await snapshot());
  const thin = await p.locator(".chart-candle .candle-body").evaluateAll((es) =>
    es
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          x: r.x + r.width / 2,
          y: r.y,
          h: r.height,
          index: e.parentElement.dataset.candleIndex,
        };
      })
      .find((b) => b.h <= 4),
  );
  assert(thin);
  await p.mouse.move(thin.x, thin.y - 7);
  await p.waitForSelector("#hover-card");
  assert.equal(
    await p.locator(".focused-candle").getAttribute("data-candle-index"),
    thin.index,
  );
  await p.keyboard.press("Escape");
  await p.locator('[data-interval="240"]').click();
  const idx = await p
    .locator('.chart-candle[data-recorded="false"]')
    .evaluateAll((es) => {
      const ns = es.map((e) => Number(e.dataset.candleIndex));
      return ns.find((n, i) => ns[i + 1] === n + 1);
    });
  const middle = p.locator(
    `.chart-candle[data-candle-index="${idx}"] .candle-body`,
  );
  await middle.hover();
  await p.waitForSelector("#hover-card");
  assert((await p.locator(".focused-candle").count()) > 1);
  assert.equal(
    await p.locator('.focused-candle[data-recorded="true"]').count(),
    0,
  );
  assert(
    (await p.locator(".moment-context").innerText()).includes(
      "Следующее событие",
    ),
  );
  await p.mouse.click(
    (await middle.boundingBox()).x + 1,
    (await middle.boundingBox()).y + 1,
    { button: "right" },
  );
  await shot("moments");
  await p.keyboard.press("Escape");
  await p.locator('[data-interval="1440"]').click();
  await p.locator("#add-event").click();
  const amount = p.locator('#event-form [name="delta"]');
  const positive = p.locator('[data-delta-sign="1"]'),
    negative = p.locator('[data-delta-sign="-1"]');
  await negative.click();
  await amount.fill("65");
  assert.equal(await negative.getAttribute("aria-pressed"), "true");
  assert((await p.locator("#impact-preview").innerText()).includes("−65"));
  await amount.fill("-1,96");
  await amount.press("ArrowUp");
  assert.equal(await amount.inputValue(), "-0.96");
  assert.equal(await negative.getAttribute("aria-pressed"), "true");
  await amount.fill("0");
  assert.equal(await positive.getAttribute("aria-pressed"), "true");
  await amount.fill("1.234");
  await p.locator('[name="text"]').fill("Проверка отрицательного процента");
  await p.locator('#event-form [type="submit"]').click();
  assert((await p.locator(".form-error").innerText()).includes("двух знаков"));
  await amount.fill("5");
  assert.equal(await p.locator(".form-error").innerText(), "");
  await negative.click();
  await p.locator('[data-unit="percent"]').click();
  await shot("event-form");
  await p.locator('#event-form [type="submit"]').click();
  await p.waitForSelector("dialog", { state: "detached" });
  const saved = JSON.parse(await snapshot()),
    added = saved.events.at(-1);
  assert.equal(added.delta, -5);
  assert.equal(added.unit, "percent");
  assert(calculate(saved).at(-1).close < calculate(original).at(-1).close);
  // Force narrow side panel and check actual bounds of the amount and percent.
  await p.locator("#side-resizer").focus();
  for (let i = 0; i < 7; i++) await p.keyboard.press("ArrowRight");
  await p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const rows = await p.locator(".day-events .event-amount").evaluateAll((es) =>
    es.map((e) => {
      const a = e.querySelector(".event-points").getBoundingClientRect(),
        b = e.querySelector(".event-percent").getBoundingClientRect();
      return {
        overlap:
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top,
        scroll: e.scrollWidth,
        width: e.clientWidth,
      };
    }),
  );
  assert(rows.length > 0);
  assert(rows.every((r) => !r.overlap && r.scroll <= r.width + 1));
  await shot("chart");
  await p.locator("#settings").click();
  await p.locator('[data-settings-tab="general"]').click();
  await p.locator('[data-coin-color="violet"]').click();
  await p.locator('[data-coin-symbol="diamond"]').click();
  await shot("coin");
  await p.locator('#settings-form [type="submit"]').click();
  await p.waitForSelector("dialog", { state: "detached" });
  assert.deepEqual(JSON.parse(await snapshot()).settings.coin, {
    color: "violet",
    symbol: "diamond",
    rim: "classic",
    label: "",
  });
  await app.close();
  app = await launch();
  p = await app.firstWindow();
  attach();
  await p.waitForSelector(".instrument-coin svg");
  assert.deepEqual(JSON.parse(await snapshot()).settings.coin, {
    color: "violet",
    symbol: "diamond",
    rim: "classic",
    label: "",
  });
  assert((await p.locator(".instrument-coin").innerHTML()).includes("#bd98ff"));
  await p.locator("#home-button").click();
  await p.waitForSelector("#new-graph");
  await p.locator("#new-graph").click();
  await p.locator('#new-graph-form [name="name"]').fill("Новая монетка");
  await p.locator('[data-coin-color="mint"]').click();
  await p.locator('[data-coin-symbol="orbit"]').click();
  await p.locator("#new-graph-form button.primary").click();
  await p.waitForSelector("dialog", { state: "detached" });
  const second = JSON.parse(await snapshot());
  assert.deepEqual(second.settings.coin, {
    color: "mint",
    symbol: "orbit",
    rim: "classic",
    label: "",
  });
  assert.equal(second.events.length, 0);
  await p.locator("#home-button").click();
  await p.waitForSelector("[data-open-graph]");
  await p.locator(`[data-open-graph="${original.id}"]`).click();
  await p.waitForSelector(".chart-candle");
  assert.deepEqual(JSON.parse(await snapshot()).events, saved.events);
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setSize(1100, 850);
    w.webContents.setZoomFactor(1.25);
  });
  await p.waitForTimeout(200);
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "V192 QA PASS: thin hit area, default grouped moments, signed decimals/step/zero/validation/save, narrow amounts, coin settings/restart/new graph/switch, responsive, preserved events",
  );
} catch (e) {
  console.log("UI errors", errors);
  await shot("failure");
  throw e;
} finally {
  await app.close();
}
