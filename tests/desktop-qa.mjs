import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work"),
  shots = path.join(work, "qa");
await fs.mkdir(shots, { recursive: true });
const dir = await fs.mkdtemp(path.join(work, "qa-profile-"));
await fs.writeFile(path.join(dir,"preferences.json"), JSON.stringify({initialized:true}));
const errors = [];
let app, page;
async function launch() {
  app = await electron.launch({
    args: [root],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined,
      VYSHE_DATA_DIR: dir,
    },
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  const late = new Date(); late.setHours(23,30,0,0);
  await page.clock.setSystemTime(late);
  await page.reload();
  await page.waitForSelector("#start-form, .overview");
}
async function shot(name) {
  await page.mouse.move(15, 15);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.screenshot({ path: path.join(shots, name + ".png") });
}
try {
  await launch();
  await shot("01-onboarding");
  await page.locator("#start-demo").click();
  await page.waitForSelector(".chart-candle .candle-body");
  await shot("02-demo-dark");
  const chart = await page.locator("#chart").boundingBox();
  const candle = await page
    .locator(".chart-candle .candle-body")
    .nth(25)
    .boundingBox();
  await page.mouse.move(
    candle.x + candle.width / 2,
    candle.y + candle.height / 2,
  );
  await page.mouse.click(
    candle.x + candle.width / 2,
    candle.y + candle.height / 2,
    { button: "right" },
  );
  await page.waitForSelector("#hover-card");
  await page.screenshot({ path: path.join(shots, "03-hover.png") });
  const card = page.locator("#hover-card");
  await card.hover();
  assert(await card.isVisible());
  await page.keyboard.press("Escape");
  await page.locator('[data-interval="1"]').click();
  await page.waitForSelector('[data-interval="1"][aria-pressed="true"]');
  await shot("04-intraday");
  await page.locator("#zoom-in").click();
  await page.locator("#zoom-in").click();
  await shot("05-intraday-zoom");
  await page.locator("#theme-toggle").click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.locator('[data-interval="1440"]').click();
  await shot("06-demo-light");
  await page.locator("#exit-demo").click();
  await page.waitForSelector("#start-form");
  assert.equal(
    await fs.stat(path.join(dir, "journal.json")).then(
      () => true,
      () => false,
    ),
    false,
    "demo must not create a journal",
  );
  await page.locator("#start-form input[name=name]").fill("Мой новый путь");
  await page.locator("#start-form input[name=initial]").fill("100");
  await page.locator("#start-form button[type=submit]").click();
  await page.locator("#coin-later").click();
  await page.waitForSelector(".overview", { timeout: 5000 });
  await page.locator("#add-event").click();
  await page.locator("#event-form textarea").fill("Радостная встреча");
  await page.locator("#event-form input[name=delta]").fill("5");
  await page.locator("[data-event-time=custom]").click();
  await page.locator('#event-form [data-time-hour="10"]').click();
  await page.locator('#event-form [data-time-minute="00"]').click();
  await page.locator("#event-form button[type=submit]").click();
  await page.waitForSelector(".event-row");
  assert.equal(await page.locator(".main-value").innerText(), "105");
  await page.locator("#add-selected").click();
  await page.locator("#event-form textarea").fill("Опоздал на учёбу");
  await page.locator("#event-form input[name=delta]").fill("-2");
  await page.locator("[data-event-time=custom]").click();
  await page.locator('#event-form [data-time-hour="09"]').click();
  await page.locator('#event-form [data-time-minute="00"]').click();
  await page.locator("#event-form button[type=submit]").click();
  await page.waitForSelector('.main-value:text-is("103")');
  assert.equal(
    await page.locator(".event-content p").first().innerText(),
    "Опоздал на учёбу",
  );
  await page.locator("#edit-day").click();
  await page.locator("#day-form input[name=title]").fill("Очень живой день");
  await page
    .locator("#day-form textarea")
    .fill("Хороший момент важнее одной ошибки. <script>alert(1)</script>");
  await page.locator("#day-form button[type=submit]").click();
  await page.waitForSelector('.day-panel h2:text-is("Очень живой день")');
  await page.locator("[data-edit]").first().click();
  await page.locator("#event-form input[name=delta]").fill("-3");
  await page.locator("#event-form button[type=submit]").click();
  await page.waitForSelector('.main-value:text-is("102")');
  await page.locator("[data-view=journal]").click();
  await page.locator("#journal-search").fill("учёбу");
  assert.equal(await page.locator(".journal-day").count(), 1);
  await page.locator("#journal-search").fill("zzzz");
  assert.equal(await page.locator(".journal-day").count(), 0);
  await page.locator("[data-view=chart]").click();
  await page.locator('[data-interval="1440"]').click();
  await page.locator("#chart").focus();
  await page.keyboard.press("ArrowLeft");
  assert(await page.locator("#hover-card").isVisible());
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#hover-card").count(), 0);
  await page.locator("#settings").click();
  await page.locator("[data-settings-tab=general]").click();
  await page.locator("#settings-form input[name=motion]").check();
  await page.locator("[data-settings-tab=appearance]").click();
  await page.locator("#settings-form select[name=theme]").selectOption("light");
  await page.locator("[data-settings-tab=general]").click();
  await page.locator("#settings-form button[type=submit]").click();
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("reduce-motion"),
  );
  await shot("07-personal-light");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(900, 700),
  );
  await page.waitForFunction(() => innerWidth <= 905);
  await shot("08-small-window");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1.25),
  );
  await page.waitForFunction(() => innerWidth <= 725);
  await shot("09-scale-125");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    "No horizontal overflow at 125%",
  );
  await app.close();
  await launch();
  assert.equal(await page.locator(".main-value").innerText(), "102");
  assert.equal(
    await page.locator(".day-panel h2").innerText(),
    "Очень живой день",
  );
  assert.equal(await page.locator(".event-row").count(), 2);
  await page.locator("[data-delete]").first().click();
  await page.locator("#confirm-delete").click();
  await page.waitForSelector('.main-value:text-is("105")');
  await page.locator("#add-selected").click();
  await page.locator("#event-form textarea").fill("Рост на два процента");
  await page.locator("#event-form input[name=delta]").fill("2");
  await page.locator("[data-event-time=custom]").click();
  await page.locator('#event-form [data-time-hour="23"]').click();
  await page.locator('#event-form [data-time-minute="00"]').click();
  await page.locator("[data-unit=percent]").click();
  assert((await page.locator("#impact-preview").innerText()).includes("+2,1"));
  await page.locator("#event-form button[type=submit]").click();
  await page.waitForSelector('.main-value:text-is("107,1")');
  const exported = path.join(work, "qa-export.json");
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ filePath, canceled: false });
  }, exported);
  await page.locator("#settings").click();
  await page.locator("[data-settings-tab=data]").click();
  await page.locator("#export").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#toast").textContent === "Дневник экспортирован",
  );
  assert.equal(
    JSON.parse(await fs.readFile(exported, "utf8")).events.filter(
      (e) => !e.deletedAt,
    ).length,
    2,
  );
  await page.locator(".modal-close").click();
  await page
    .locator(".event-row")
    .filter({ hasText: "Радостная встреча" })
    .locator("[data-delete]")
    .click();
  await page.locator("#confirm-delete").click();
  await page.waitForSelector('.main-value:text-is("102")');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      filePaths: [filePath],
      canceled: false,
    });
  }, exported);
  await page.locator("#settings").click();
  await page.locator("[data-settings-tab=data]").click();
  await page.locator("#import").click();
  await page.waitForSelector("#confirm-import");
  await page.locator("#confirm-import").click();
  await page.waitForSelector('.main-value:text-is("107,1")');
  const invalid = path.join(work, "qa-invalid.json");
  await fs.writeFile(invalid, '{"schemaVersion":999}');
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({
      filePaths: [filePath],
      canceled: false,
    });
  }, invalid);
  await page.locator("#settings").click();
  await page.locator("[data-settings-tab=data]").click();
  await page.locator("#import").click();
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("Импорт отменён"),
  );
  assert.equal(await page.locator(".main-value").innerText(), "107,1");
  await page.locator(".modal-close").click();
  await shot("10-after-restart");
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(shots, "result.json"),
    JSON.stringify(
      {
        passed: true,
        errors,
        dataDirectory: dir,
        screenshots: await fs.readdir(shots),
      },
      null,
      2,
    ),
  );
  console.log("DESKTOP QA PASS", dir);
} catch (error) {
  console.log("JS errors", errors);
  console.log("QA failure state", await page.locator("body").innerText());
  throw error;
} finally {
  await app?.close().catch(() => {});
}
