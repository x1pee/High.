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
const dir = await fs.mkdtemp(path.join(work, "v191-profile-")),
  shots = path.join(work, "v191-qa");
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
  const original = await snapshot();
  const quote = () => p.locator(".footer-quote").innerText();
  let before = await quote();
  await p.locator('button[data-view="chart"]').click();
  assert.equal(await quote(), before);
  await p.locator("#show-average").click();
  assert.equal(await quote(), before);
  await p.locator("#home-button").click();
  await p.waitForSelector(".graph-card");
  await shot("menu");
  await p.locator('button[data-view="chart"]').click();
  assert.notEqual(await quote(), before);
  before = await quote();
  await p.locator('button[data-view="journal"]').click();
  await p.locator('button[data-view="chart"]').click();
  assert.notEqual(await quote(), before);
  const boxes = await p.locator(".market-metrics > div").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y };
    }),
  );
  assert.equal(boxes.length, 6);
  for (let i = 0; i < 3; i++) {
    assert(Math.abs(boxes[i].x - boxes[i + 3].x) < 1, "columns aligned");
    assert(Math.abs(boxes[i].y - boxes[0].y) < 1, "top row aligned");
    assert(Math.abs(boxes[i + 3].y - boxes[3].y) < 1, "bottom row aligned");
  }
  await p.locator("#add-event").click();
  const placeholder = (
    await p.locator('[name="text"]').getAttribute("placeholder")
  )
    .replace(/^Например, /, "")
    .toLocaleLowerCase("ru");
  for (let i = 0; i < 3; i++) {
    await p.locator(".event-examples summary").click();
    await p.waitForFunction(
      () => document.querySelectorAll(".example-results button").length > 10,
    );
    const ideas = await p.locator(".example-results button").allTextContents();
    assert(
      !ideas
        .slice(0, 10)
        .some((t) => t.toLocaleLowerCase("ru") === placeholder),
    );
    await p.locator(".event-examples summary").click();
  }
  await p.locator(".modal-close").click();
  await p.waitForSelector("dialog", { state: "detached" });
  await shot("chart");
  const candleBounds = () =>
    p.locator(".chart-candle").first().getAttribute("transform");
  // Overlay controls must not alter candle coordinates or sizes.
  const paths = () =>
    p
      .locator(".chart-candle .candle-body")
      .evaluateAll((els) => els.map((e) => e.outerHTML));
  const shape = await paths();
  await p.locator("#show-base").click();
  await p.locator("#show-average").click();
  assert.deepEqual(await paths(), shape);
  before = await quote();
  await p.locator("#theme-toggle").click();
  await p.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  assert.equal(await quote(), before);
  await shot("light");
  // UI settings may change, diary events may not.
  assert.deepEqual(
    JSON.parse(await snapshot()).events,
    JSON.parse(original).events,
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1100, 850),
  );
  await p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1.25),
  );
  await p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "V191 QA PASS: quote navigation/stability, ideas exclusion, aligned metrics, price-only scale, themes, responsive, immutable events",
  );
} catch (e) {
  await shot("failure");
  throw e;
} finally {
  await app.close();
}
