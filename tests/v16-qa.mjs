import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { localDate, shiftDate } from "../src/domain.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work");
const dir = await fs.mkdtemp(path.join(work, "v16-profile-")),
  shots = path.join(work, "v16-qa");
await fs.mkdir(shots, { recursive: true });
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
const attach = () => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept().catch(() => {}));
};
attach();
const data = () =>
  p.evaluate(async () => (await window.desktop.load()).journal);
async function shot(name) {
  await p.mouse.move(0, 0);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() =>
    Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    ),
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
  await p.locator("#start-form button[type=submit]").click();
  await p.waitForSelector("#first-event");
  for (let day = 1; day <= 21; day++) {
    await p.locator("#random-event").click();
    await p.waitForFunction(
      (n) =>
        document
          .querySelector(".market-metrics div:last-child strong")
          ?.childNodes[0].textContent.trim() === String(n),
      day * 6,
    );
  }
  const j = await data(),
    dates = [...new Set(j.events.map((e) => e.date))].sort();
  assert.equal(dates.length, 21);
  assert.equal(dates[0], shiftDate(localDate(), -21));
  assert.equal(dates.at(-1), shiftDate(localDate(), -1));
  assert(j.events.every((e) => e.test));
  await p.locator('[data-interval="240"]').click();
  assert.equal(await p.locator("[data-interval]").count(), 10);
  assert.equal(await p.locator("#visible-range,[data-period]").count(), 0);
  assert((await p.locator(".candle-body").count()) > 110);
  assert((await p.locator("#range-label").innerText()).includes("—"));
  const beforeDrag = await p.locator("#range-label").innerText();
  const dragBox = await p.locator("#chart").boundingBox();
  await p.mouse.move(
    dragBox.x + dragBox.width * 0.4,
    dragBox.y + dragBox.height * 0.4,
  );
  await p.mouse.down();
  await p.mouse.move(
    dragBox.x + dragBox.width * 0.65,
    dragBox.y + dragBox.height * 0.4,
    { steps: 12 },
  );
  await p.mouse.up();
  assert.notEqual(await p.locator("#range-label").innerText(), beforeDrag);
  await p.locator('[data-interval="240"]').click();
  await p.locator("#show-average").click();
  assert.equal(await p.locator(".average-line").count(), 1);
  await p.locator("#show-base").click();
  assert.equal(await p.locator(".base-line").count(), 1);
  await p.locator("#percent-axis").click();
  assert((await p.locator(".axis-label").first().textContent()).includes("%"));
  await p.locator("#measure-tool").click();
  const box = await p.locator("#chart").boundingBox();
  await p.locator(".chart-candle .candle-body").nth(20).click();
  await p.locator(".chart-candle .candle-body").nth(90).click();
  assert((await p.locator("#measure-output").innerText()).includes("свечей"));
  await p.keyboard.press("Escape");
  await p.locator("#show-average").hover();
  assert(await p.locator("#tool-tip").isVisible());
  await p.locator("#rail-level").click();
  await p.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.4);
  assert.equal(await p.locator(".drawn-level").count(), 1);
  await p.locator("#rail-trend").click();
  await p.locator('[data-drawing-option="trend"]').click();
  await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
  assert((await p.locator("#drawing-status").innerText()).includes("вторую"));
  await p.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.3);
  assert.equal(await p.locator(".drawn-trend").count(), 1);
  await p.locator("#rail-hide").click();
  assert.equal(await p.locator(".drawn-trend").count(), 0);
  await p.locator("#rail-hide").click();
  assert.equal(await p.locator(".drawn-trend").count(), 1);
  await p.locator("#zoom-in").click();
  assert.equal(await p.locator(".drawn-trend").count(), 1);
  await p.locator("#rail-undo").click();
  assert.equal(await p.locator(".drawn-trend").count(), 0);
  assert.equal(await p.locator(".drawn-level").count(), 1);
  await p.locator("#rail-magnet").click();
  assert.equal(
    await p.locator("#rail-magnet").getAttribute("aria-pressed"),
    "false",
  );
  await p.locator("#rail-date").click();
  await p.locator("#goto-date-form input").fill(shiftDate(localDate(), -10));
  await p.locator("#goto-date-form button").click();
  assert.equal(
    await p.locator("#selected-date").inputValue(),
    shiftDate(localDate(), -10),
  );
  assert(!(await p.locator("#next").isDisabled()));
  await p.locator('[data-interval="240"]').click();
  await shot("4h-tools");
  await p.keyboard.press("Escape");
  await p.locator('[data-interval="60"]').click();
  await p.locator("#zoom-in").click();
  await p.locator("#previous").click();
  const past = await p.locator("#range-label").innerText();
  await p.locator("#today").click();
  assert.notEqual(await p.locator("#range-label").innerText(), past);
  assert(await p.locator("#next").isDisabled());
  await p.locator('[data-interval="5"]').click();
  await p.locator("#zoom-out").click();
  await p.locator("#previous").click();
  assert((await p.locator(".candle-body").count()) > 100);
  await p.locator('[data-interval="240"]').click();
  await p.locator('[data-ledger="notes"]').click();
  await p.locator("#quick-note textarea").fill("Запись прямо под графиком");
  await p.locator("#show-average").click();
  assert.equal(
    await p.locator("#quick-note textarea").inputValue(),
    "Запись прямо под графиком",
  );
  await p.locator("#quick-note button[type=submit]").click();
  await p.waitForSelector('#note-status:text-is("Сохранено")');
  assert(
    (await data()).days.some((d) => d.note === "Запись прямо под графиком"),
  );
  await shot("notes");
  for (const interval of [10080, 43200, 129600, 525600]) {
    await p.locator(`[data-interval="${interval}"]`).click();
    assert((await p.locator(".candle-body").count()) > 0);
    await p.locator("#rail-focus").click();
    await p.keyboard.press("ArrowRight");
    assert(
      (await p.locator("#hover-card .hover-top").innerText()).includes("—"),
    );
    await p.keyboard.press("Escape");
  }
  await p.locator("#add-event").click();
  await p.locator(".event-examples summary").click();
  await p.waitForFunction(
    () => document.querySelectorAll(".example-results button").length === 500,
  );
  const first = await p.locator(".example-results button").first().innerText();
  await p.locator(".event-examples summary").click();
  await p.locator(".event-examples summary").click();
  await p.waitForFunction(
    (first) =>
      document.querySelector(".example-results button")?.textContent !== first,
    first,
  );
  await p.locator('[data-example-category="Дом"]').click();
  assert.equal(await p.locator(".example-results button").count(), 50);
  await p.locator("#example-search").fill("кух");
  assert((await p.locator(".example-results button").count()) > 0);
  const picked = await p.locator(".example-results button").first().innerText();
  await p.locator(".example-results button").first().click();
  assert.equal(await p.locator('textarea[name="text"]').inputValue(), picked);
  await shot("examples");
  await p.locator(".modal-close").click();
  await p.locator('[data-interval="1440"]').click();
  await p.locator("#rail-focus").click();
  await p.keyboard.press("ArrowRight");
  assert(
    !["Шаг вперёд", "Непростой день"].includes(
      await p.locator("#hover-card h3").innerText(),
    ),
  );
  await p.keyboard.press("Escape");
  assert(
    await p.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  );
  await p.locator("#theme-toggle").click();
  await p.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await shot("light");
  const savedNoteDate = (await data()).days.find(
    (d) => d.note === "Запись прямо под графиком",
  ).date;
  await app.close();
  app = await launch();
  p = await app.firstWindow();
  attach();
  await p.waitForSelector("#chart");
  await p.locator("#selected-date").fill(savedNoteDate);
  await p.locator("#selected-date").press("Tab");
  await p.locator('[data-ledger="notes"]').click();
  assert.equal(
    await p.locator("#quick-note textarea").inputValue(),
    "Запись прямо под графиком",
  );
  assert.equal((await data()).events.length, 126);
  for (let day = 22; day <= 32; day++) {
    await p.locator("#random-event").click();
    await p.waitForFunction(
      (n) =>
        document
          .querySelector(".market-metrics div:last-child strong")
          ?.childNodes[0].textContent.trim() === String(n),
      day * 6,
    );
  }
  const oldest = shiftDate(localDate(), -32);
  assert.equal(await p.locator("#selected-date").inputValue(), oldest);

  assert(
    (await p.locator("#range-label").innerText()).startsWith(
      new Date(oldest + "T12:00:00").toLocaleDateString("ru", {
        day: "numeric",
        month: "short",
      }),
    ),
  );

  assert.deepEqual(errors, []);
  console.log(
    "V1.6 UI PASS: contiguous generated days, multi-day 4h/1h/5m, single toolbar, weekly/monthly/quarter/year aggregation, pan, no future, average/base/percent/ruler, drawing tools/date jump, 500 shuffled examples, direct notes/drafts/restart, light/dark, window fit",
  );
} catch (error) {
  console.log("UI ERRORS", errors);
  console.log(await p.locator("body").innerText());
  throw error;
} finally {
  await app.close();
}
