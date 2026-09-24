import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {
  createJournal,
  upsertEvent,
  localDate,
  shiftDate,
} from "../src/domain.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work");
const dir = await fs.mkdtemp(path.join(work, "v19-profile-")),
  shots = path.join(work, "v19-qa");
await fs.mkdir(shots, { recursive: true });
await fs.writeFile(path.join(dir,"preferences.json"), JSON.stringify({initialized:true}));
let journal = createJournal("Мой ритм", 1000);
for (let d = 39; d >= 0; d--)
  for (let k = 0; k < 2; k++)
    journal = upsertEvent(journal, {
      date: shiftDate(localDate(), -d),
      time: d === 0 ? (k ? "00:05" : "00:00") : k ? "16:30" : "08:00",
      text: k ? "Прогулка с близким человеком" : "Закончил важную задачу",
      delta: k ? (d % 3 ? -8 : 12) : d % 4 ? 20 : -14,
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
  const original = await snapshot();
  assert.equal(await p.locator("#show-average").innerText(), "MA");
  for (const n of [30, 90, 180, 365])
    assert(await p.locator(`[data-stat-period="${n}"]`).isVisible());
  const baseRange = await p.locator("#range-label").innerText();
  const candleX = await p.locator(".chart-candle").first().boundingBox();
  await p.locator("#auto-range").click();
  assert.equal(
    await p.locator("#auto-range").getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(await p.locator("#range-label").innerText(), baseRange);
  await p.locator("#show-average").click();
  assert.equal(
    await p.locator("#range-label").innerText(),
    baseRange,
    "Other controls do not change frozen auto range",
  );
  assert(
    Math.abs(
      (await p.locator(".chart-candle").first().boundingBox()).x - candleX.x,
    ) < 1,
  );
  await p.locator("#auto-range").click();
  const body = await point(-10);
  await p.mouse.click(body.x, body.y);
  const selected = await p.locator("#selected-date").inputValue();
  assert.notEqual(selected, localDate());
  assert(!(await p.locator(".hover-top").innerText()).includes("Открепить"));
  await p.mouse.move(8, 30);
  await p.waitForFunction(() => !document.querySelector("#hover-card"));
  assert.equal(await p.locator("#selected-date").inputValue(), selected);
  await p.mouse.click(body.x, body.y, { button: "right" });
  assert((await p.locator(".hover-top").innerText()).includes("Открепить"));
  await p.mouse.move(8, 30);
  assert(await p.locator("#hover-card").isVisible());
  await p.locator("#pin-hover").click();
  await p.mouse.move(8, 30);
  await p.waitForFunction(() => !document.querySelector("#hover-card"));
  let placeholder;
  for (let i = 0; i < 3; i++) {
    await p.locator("#rail-note").click();
    const next = await p
      .locator("#day-form input[name=title]")
      .getAttribute("placeholder");
    assert.notEqual(next, placeholder);
    placeholder = next;
    await p.locator(".modal-close").click();
  }
  await p.locator('[data-interval="240"]').click();
  const betweenIndex = await p
    .locator('.chart-candle[data-recorded="false"][data-synthetic="true"]')
    .evaluateAll((es) => {
      const indices = es.map((e) => Number(e.dataset.candleIndex));
      return indices.find((n, i) => indices[i + 1] === n + 1);
    });
  const between = p.locator(
    `.chart-candle[data-candle-index="${betweenIndex}"] .candle-body`,
  );
  if (
    (await p.locator("#group-moments").getAttribute("aria-pressed")) === "true"
  )
    await p.locator("#group-moments").click();
  await between.hover();
  await p.waitForSelector("#hover-card");
  assert.equal(await p.locator(".focused-candle").count(), 1);
  assert(
    (await p.locator(".moment-context").innerText()).includes(
      "Следующее событие",
    ),
  );
  await p.locator("#group-moments").click();
  await between.hover();
  await p.waitForSelector("#hover-card");
  assert((await p.locator(".focused-candle").count()) > 1);
  assert(
    (await p.locator("#hover-card h3").innerText()).includes("весь участок"),
  );
  assert.equal(
    await p.locator('.focused-candle[data-recorded="true"]').count(),
    0,
  );
  await p.mouse.click(
    (await between.boundingBox()).x + 2,
    (await between.boundingBox()).y + 1,
    { button: "right" },
  );
  await shot("moments");
  await p.keyboard.press("Escape");
  await p.locator("#group-moments").click();
  // Diagonal corner and horizontal divider: both dimensions persist independently.
  await p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const before = await p.locator("#chart").boundingBox();
  const corner = await p.locator("#panel-corner").boundingBox();
  await p.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await p.mouse.down();
  await p.mouse.move(
    corner.x + corner.width / 2 + 40,
    corner.y + corner.height / 2 + 35,
    { steps: 8 },
  );
  await p.mouse.up();
  await p.waitForFunction(
    (w) => document.querySelector("#chart").clientWidth > w + 25,
    before.width,
  );
  assert((await p.locator("#chart").boundingBox()).height > before.height + 20);
  const layout = await p.evaluate(() =>
    localStorage.getItem("vyshe-panel-layout"),
  );
  await p.locator('[data-interval="1440"]').click();
  const chart = await p.locator("#chart").boundingBox();
  const a = {
    x: chart.x + chart.width * 0.25,
    y: chart.y + chart.height * 0.45,
  };
  const b = {
    x: chart.x + chart.width * 0.65,
    y: chart.y + chart.height * 0.25,
  };
  for (const type of ["trend", "arrow", "vertical"]) {
    await p.locator("#rail-trend").hover();
    await p.locator(`[data-drawing-option="${type}"]`).click();
    await p.mouse.click(a.x, a.y);
    if (type !== "vertical") await p.mouse.click(b.x, b.y);
  }
  assert.equal(await p.locator(".drawn-trend").count(), 2);
  assert.equal(await p.locator(".drawn-vertical").count(), 1);
  assert(
    (
      await p.locator('[data-drawing-type="arrow"]').getAttribute("marker-end")
    ).includes("trend-arrow"),
  );
  const c = await point(-4);
  await p.mouse.move(c.x, c.y);
  await p.waitForSelector("#hover-card");
  await p.locator(".hover-top").hover();
  await p.waitForTimeout(250);
  assert(
    Number(
      await p
        .locator("#drawing-layer")
        .evaluate((e) => getComputedStyle(e).opacity),
    ) < 0.3,
  );
  await p.keyboard.press("Escape");
  await p.mouse.move(8, 30);
  await p.locator("#rail-magnet").click();
  assert.equal(
    await p.locator("#rail-magnet").getAttribute("aria-pressed"),
    "false",
  );
  await p.keyboard.press("Control+z");
  assert.equal(
    await p.locator("#rail-magnet").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await p.locator(".drawn-vertical").count(), 1);
  await p.keyboard.press("Control+z");
  assert.equal(await p.locator(".drawn-vertical").count(), 0);
  await p.keyboard.press("Control+z");
  assert.equal(await p.locator(".drawn-trend").count(), 1);
  assert.equal(await snapshot(), original);
  await shot("chart");
  await p.locator("#theme-toggle").click();
  await p.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await shot("light");
  await app.close();
  app = await launch();
  p = await app.firstWindow();
  attach();
  await p.waitForSelector(".chart-candle");
  assert.equal(
    await p.evaluate(() => localStorage.getItem("vyshe-panel-layout")),
    layout,
  );
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setSize(1100, 850);
    w.webContents.setZoomFactor(1.25);
  });
  await p.waitForTimeout(300);
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "V19 QA PASS: MA, frozen Auto toggle, click/pin, grouped moments, 50 placeholders, period stats, diagonal resize/restart, 3 drawing tools, dimming, Ctrl+Z, immutable data, themes",
  );
} catch (e) {
  console.log("UI errors", errors);
  console.log((await p.locator("body").innerText()).slice(-5000));
  await shot("failure");
  throw e;
} finally {
  await app.close().catch(() => {});
}
