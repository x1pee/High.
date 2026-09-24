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
const dir = await fs.mkdtemp(path.join(work, "v17-profile-")),
  shots = path.join(work, "v17-qa");
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
  const original = await snapshot(),
    range = await p.locator("#range-label").innerText();
  const c = await point(),
    chart = await p.locator("#chart").boundingBox(),
    blank = { x: c.x, y: chart.y + chart.height - 45 };
  await p.mouse.move(blank.x, blank.y);
  assert.equal(await p.locator("#hover-card").count(), 0);
  await p.mouse.move(c.x, c.y);
  await p.waitForSelector("#hover-card");
  await p.mouse.move(blank.x, blank.y);
  await p.waitForFunction(() => !document.querySelector("#hover-card"));
  await p.mouse.click(blank.x, blank.y);
  assert.equal(await p.locator("#selected-date").inputValue(), localDate());
  await p.mouse.move(c.x + 5, c.y);
  await p.waitForSelector("#hover-card");
  await p.mouse.click(c.x, c.y);
  await p.mouse.click(c.x, c.y, { button: "right" });
  assert((await p.locator(".hover-top").innerText()).includes("ЗАКРЕПЛЕНО"));
  const chosen = await p.locator("#selected-date").inputValue();
  assert.notEqual(chosen, localDate());
  await p.locator("#rail-note").hover();
  assert(
    (await p.locator("#tool-tip").innerText()).includes(
      new Date(chosen + "T12:00:00").toLocaleDateString("ru", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    ),
  );
  await p.locator("#rail-note").click();
  assert(
    (await p.locator(".modal-eyebrow").innerText()).includes(
      chosen.slice(0, 4),
    ),
  );
  await p.locator(".modal-close").click();
  await p.locator("#rail-focus").click();
  assert.equal(await p.locator("#hover-card").count(), 0);
  await p.locator("#rail-magnet").click();
  await p.locator("#rail-level").click();
  await p.mouse.click(blank.x, blank.y);
  assert.equal(await p.locator(".drawn-level").count(), 1);
  await p.mouse.move(blank.x + 30, blank.y);
  assert.equal(await p.locator("#hover-card").count(), 0);
  await p.mouse.click(blank.x + 30, blank.y);
  assert.equal(await p.locator("#selected-date").inputValue(), chosen);
  for (const id of [
    "rail-focus",
    "rail-level",
    "rail-trend",
    "rail-magnet",
    "rail-hide",
    "rail-undo",
    "rail-date",
    "rail-note",
    "rail-expand",
    "show-base",
    "percent-axis",
    "measure-tool",
    "previous",
    "next",
    "today",
    "auto-range",
    "zoom-in",
    "zoom-out",
  ]) {
    await p.locator("#" + id).hover();
    assert(await p.locator("#tool-tip").isVisible(), id);
    assert((await p.locator("#tool-tip span").innerText()).length > 25, id);
    assert.equal(await p.locator("#" + id).getAttribute("title"), null, id);
  }
  for (const period of [7, 14, 28]) {
    await p.locator(`[data-average="${period}"]`).click();
    assert.equal(
      await p.locator("#show-average").getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await p.locator("[data-average][aria-pressed=true]").count(),
      [7, 14, 28].indexOf(period) + 1,
    );
    assert.equal(
      await p
        .locator(`.average-line[data-average-period="${period}"]`)
        .getAttribute("data-average-period"),
      String(period),
    );
  }
  await p.locator("#show-average").click();
  assert.equal(await p.locator(".average-line").count(), 0);
  await p.locator("#show-average").click();
  assert.equal(
    await p.locator('[data-average="28"]').getAttribute("aria-pressed"),
    "true",
  );
  await p.locator("#show-average").hover();
  assert((await p.locator("#tool-tip").innerText()).includes("28 — плавнее"));
  await shot("average-help");
  await p.locator('[data-chart-style="candles"]').hover();
  await p.waitForSelector("#chart-style-menu");
  await p.locator('[data-style-option="hollow"]').hover();
  assert(
    await p
      .locator("#chart-style-menu")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  );
  await shot("styles");
  for (const style of ["hollow", "heikin", "bars", "line", "candles"]) {
    if (style === "line") await p.locator('[data-chart-style="line"]').click();
    else {
      await p.locator('[data-chart-style="candles"]').hover();
      await p.locator(`[data-style-option="${style}"]`).click();
    }
    assert.equal(await p.locator("#chart").getAttribute("data-style"), style);
    if (style === "bars") assert((await p.locator(".ohlc-bar").count()) > 35);
    if (style === "hollow")
      assert(
        (await p.locator('.candle-body[fill="var(--surface)"]').count()) > 0,
      );
    if (style === "heikin") {
      const h = await point();
      await p.mouse.move(h.x, h.y);
      await p.waitForSelector("#hover-card");
      assert(
        (await p.locator("#hover-card").innerText()).includes(
          "реальные значения",
        ),
      );
      await p.keyboard.press("Escape");
    }
  }
  assert.equal(await snapshot(), original);
  await p.locator("#measure-tool").click();
  const first = await point(-20),
    last = await point(-2);
  await p.mouse.click(blank.x, blank.y);
  assert((await p.locator("#measure-output").innerText()).includes("первую"));
  await p.mouse.click(first.x, first.y);
  await p.mouse.click(last.x, last.y);
  assert((await p.locator("#measure-output").innerText()).includes("свечей"));
  await p.keyboard.press("Escape");
  for (let n = 0; n < 9; n++) await p.locator("#zoom-in").click();
  assert.notEqual(await p.locator("#range-label").innerText(), range);
  await p.locator("#auto-range").click();
  assert.equal(await p.locator("#range-label").innerText(), range);
  await p.locator("#previous").click();
  assert.notEqual(await p.locator("#range-label").innerText(), range);
  await p.locator("#today").click();
  assert.equal(await p.locator("#selected-date").inputValue(), localDate());
  await p.locator("#rail-note").click();
  assert(
    (await p.locator(".modal-eyebrow").innerText()).includes(
      new Date().toLocaleDateString("ru", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    ),
  );
  await p.locator(".modal-close").click();
  await p.mouse.move(0, 0);
  await shot("chart");
  await p.locator("#theme-toggle").click();
  await p.mouse.move(0, 0);
  await shot("light");
  assert(
    await p.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  );
  await app.close();
  app = await launch();
  p = await app.firstWindow();
  attach();
  await p.waitForSelector("#chart");
  await p.locator("#rail-note").click();
  assert(
    (await p.locator(".modal-eyebrow").innerText()).includes(
      new Date().toLocaleDateString("ru", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    ),
  );
  await p.locator(".modal-close").click();
  await p.locator("#show-average").click();
  assert.equal(
    await p.locator('[data-average="28"]').getAttribute("aria-pressed"),
    "true",
  );
  await p.locator("#random-event").click();
  await p.waitForFunction(
    () =>
      document
        .querySelector(".market-metrics div:last-child strong")
        ?.childNodes[0].textContent.trim() === "86",
  );
  await p.locator("#rail-note").click();
  assert(
    (await p.locator(".modal-eyebrow").innerText()).includes(
      new Date().toLocaleDateString("ru", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    ),
  );
  await p.locator(".modal-close").click();
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setSize(1040, 800);
    w.webContents.setZoomFactor(1.25);
  });
  await p.locator('[data-chart-style="candles"]').hover();
  await p.waitForSelector("#chart-style-menu");
  assert(
    await p.locator("#chart-style-menu").evaluate((e) => {
      const r = e.getBoundingClientRect();
      return (
        e.scrollWidth <= e.clientWidth + 1 &&
        r.left >= 0 &&
        r.right <= innerWidth &&
        r.top >= 0 &&
        r.bottom <= innerHeight
      );
    }),
  );
  await p.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log(
    "V1.7 UI PASS: candle proximity/blank area/drawing isolation, custom tooltips, BNA 7/14/28 + restart, five chart styles, raw values unchanged, measurement, auto zoom, explicit day, light/dark",
  );
} catch (e) {
  console.log("JS ERRORS", errors);
  console.log(await p.locator("body").innerText());
  throw e;
} finally {
  await app.close();
}
