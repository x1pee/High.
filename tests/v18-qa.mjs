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
const dir = await fs.mkdtemp(path.join(work, "v18-profile-")),
  shots = path.join(work, "v18-qa");
await fs.mkdir(shots, { recursive: true });
let journal = createJournal("Мой ритм", 1000);
for (let d = 39; d >= 0; d--)
  for (let k = 0; k < 2; k++)
    journal = upsertEvent(journal, {
      date: shiftDate(localDate(), -d),
      time: k ? "00:05" : "00:00",
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
  assert.equal(await p.locator(".brand").innerText(), "High.");
  assert.equal(
    await p.locator("#auto-range").getAttribute("aria-pressed"),
    "true",
  );
  for (const control of ["#zoom-in", "#zoom-out", "#previous", "#today"]) {
    await p.locator(control).click();
    assert.equal(
      await p.locator("#auto-range").getAttribute("aria-pressed"),
      "false",
      control,
    );
    await p.locator("#auto-range").click();
    assert.equal(
      await p.locator("#auto-range").getAttribute("aria-pressed"),
      "true",
    );
  }
  for (const n of [7, 14, 28]) await p.locator(`[data-average="${n}"]`).click();
  assert.equal(await p.locator(".average-line").count(), 3);
  assert.equal(
    await p.locator('[data-average][aria-pressed="true"]').count(),
    3,
  );
  const colors = await p
    .locator(".average-line")
    .evaluateAll((es) => es.map((e) => getComputedStyle(e).stroke));
  assert.equal(new Set(colors).size, 3);
  await p.locator('[data-average="14"]').click();
  assert.equal(await p.locator(".average-line").count(), 2);
  await p.locator("#show-average").click();
  assert.equal(await p.locator(".average-line").count(), 0);
  await p.locator("#show-average").click();
  assert.equal(await p.locator(".average-line").count(), 2);
  await p.locator('[data-average="14"]').click();
  await p.locator('[data-chart-style="candles"]').hover();
  await p.waitForSelector("#chart-style-menu");
  assert.equal(await p.locator("[data-style-option]").count(), 4);
  assert.equal(await p.locator('[data-style-option="line"]').count(), 0);
  await p.locator('[data-style-option="hollow"]').click();
  await p.locator('[data-chart-style="line"]').click();
  assert.equal(await p.locator("#chart").getAttribute("data-style"), "line");
  await p.locator('[data-chart-style="candles"]').hover();
  await p.locator('[data-style-option="candles"]').click();
  const initialPanel = await p.locator(".activity-panel").boundingBox();
  assert(initialPanel.height >= 190, JSON.stringify(initialPanel));
  const initialPlot = await p.locator("#chart").boundingBox();
  const sep = await p.locator("#panel-resizer").boundingBox();
  await p.mouse.move(sep.x + sep.width / 2, sep.y + sep.height / 2);
  await p.mouse.down();
  await p.mouse.move(sep.x + sep.width / 2, sep.y + sep.height / 2 - 65, {
    steps: 8,
  });
  await p.mouse.up();
  await p.waitForFunction(
    (h) =>
      document.querySelector(".activity-panel").getBoundingClientRect().height >
      h + 40,
    initialPanel.height,
  );
  assert(
    (await p.locator("#chart").boundingBox()).height < initialPlot.height - 40,
  );
  await p.locator("#panel-resizer").dblclick();
  await p.locator("#ledger-position").click();
  assert(
    (await p.locator(".activity-panel").boundingBox()).y <
      (await p.locator(".chart-panel").boundingBox()).y,
  );
  await p.locator("#panel-resizer").focus();
  await p.keyboard.press("ArrowDown");
  const savedHeight = await p
    .locator("#panel-resizer")
    .getAttribute("aria-valuenow");
  await p.locator("#rail-expand").click();
  assert.equal(await p.locator(".activity-panel").isVisible(), false);
  assert.equal(await p.locator("#panel-resizer").isVisible(), false);
  await p.locator("#rail-expand").click();
  await p.locator("#ledger-position").click();
  await p.locator("#panel-resizer").dblclick();
  await shot("chart");
  for (const interval of [10080, 43200, 129600, 525600]) {
    await p.locator(`[data-interval="${interval}"]`).click();
    assert.equal(
      await p.locator("#auto-range").getAttribute("aria-pressed"),
      "true",
    );
    const bodies = await p
      .locator(".chart-candle .candle-body")
      .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().x));
    for (let i = 1; i < bodies.length; i++)
      assert(bodies[i] - bodies[i - 1] <= 33, "Compact calendar spacing");
    if (interval === 43200) {
      assert.equal(
        await p.locator(".chart-candle").count(),
        2,
        "Only the two observed months",
      );
      assert.equal(
        await p.locator(".average-line").count(),
        0,
        "Do not invent history to calculate a 7+ month mean",
      );
      await shot("monthly");
    }
  }
  await p.locator('[data-interval="60"]').click();
  for (let i = 0; i < 9; i++) await p.locator("#zoom-out").click();
  assert.equal(await p.locator("#chart-svg .chart-candle circle").count(), 0);
  await p.locator("#rhythm-toggle").uncheck();
  assert.equal(await p.locator("#chart-svg .chart-candle circle").count(), 0);
  await p.locator("#rhythm-toggle").check();
  const labels = await p.locator(".time-axis-label").evaluateAll((es) => {
    const svg = document.querySelector("#chart-svg").getBoundingClientRect();
    return es.map((e) => {
      const r = e.getBoundingClientRect();
      return {
        left: r.left - svg.left,
        right: r.right - svg.left,
        width: svg.width,
      };
    });
  });
  assert(
    labels.every((r) => r.left >= 0 && r.right <= r.width),
    JSON.stringify(labels),
  );
  for (let i = 1; i < labels.length; i++)
    assert(
      labels[i].left >= labels[i - 1].right + 9,
      "Date labels must not overlap",
    );
  await shot("dense");
  await p.locator("#auto-range").click();
  const chart = await p.locator("#chart").boundingBox();
  await p.mouse.move(chart.x + chart.width / 2, chart.y + 40);
  await p.mouse.down();
  await p.mouse.move(chart.x + chart.width / 2 + 80, chart.y + 40, {
    steps: 8,
  });
  await p.mouse.up();
  assert.equal(
    await p.locator("#auto-range").getAttribute("aria-pressed"),
    "false",
    "Drag exits auto",
  );
  // Toggles restore the original data except the journal revision, so compare events/notes/settings.
  const after = JSON.parse(await snapshot()),
    before = JSON.parse(original);
  assert.deepEqual(after.events, before.events);
  assert.deepEqual(after.days, before.days);
  assert.deepEqual(after.settings, before.settings);
  await p.locator('[data-interval="1440"]').click();
  await p.locator("#ledger-position").click();
  await p.locator("#panel-resizer").focus();
  await p.keyboard.press("ArrowDown");
  const storedLayout = await p.evaluate(() =>
    localStorage.getItem("vyshe-panel-layout"),
  );
  await app.close();
  app = await launch();
  p = await app.firstWindow();
  attach();
  await p.waitForSelector(".chart-candle");
  assert(
    await p
      .locator(".workspace")
      .evaluate((e) => e.classList.contains("activity-above")),
  );
  assert.equal(
    await p.evaluate(() => localStorage.getItem("vyshe-panel-layout")),
    storedLayout,
  );
  await p.locator("#show-average").click();
  assert.equal(await p.locator(".average-line").count(), 3);
  await p.locator("#theme-toggle").click();
  await shot("light");
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setSize(1040, 800);
    w.webContents.setZoomFactor(1.25);
  });
  await p.waitForTimeout(250);
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "V18 QA PASS: multi-BNA, four-style menu, Auto, compact calendars, no dots, bounded labels, resize/reorder/restart, themes, immutable records",
  );
} finally {
  await app.close().catch(() => {});
}
