import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work");
const dir = await fs.mkdtemp(path.join(work, "v14-profile-"));
const shots = path.join(work, "v14-qa");
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
p.on("pageerror", (e) => errors.push(e.message));
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
  const png = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
      .toPNG()
      .toString("base64"),
  );
  await fs.writeFile(
    path.join(shots, name + ".png"),
    Buffer.from(png, "base64"),
  );
}
async function home() {
  await p.locator("#home-button").click();
  await p.waitForSelector("#new-graph");
}
try {
  await p.locator("#start-form [name=name]").fill("Жизнь");
  await p.locator("#start-form button[type=submit]").click();
  await p.waitForSelector("#first-event");
  await p.evaluate(() => document.fonts.ready);
  const overflow = await p.evaluate(() => ({
    h: innerHeight,
    scroll: document.documentElement.scrollHeight,
  }));
  assert(overflow.scroll <= overflow.h + 1, JSON.stringify(overflow));
  await p.locator("#first-event").click();
  const formSize = await p
    .locator("dialog")
    .evaluate((el) => ({ h: el.clientHeight, scroll: el.scrollHeight }));
  assert(formSize.scroll <= formSize.h + 1, JSON.stringify(formSize));
  const today = await p.locator("[data-event-date=today]").boundingBox(),
    custom = await p.locator("[data-event-date=custom]").boundingBox();
  assert(today.width / custom.width > 2.8);
  await p.locator("#event-form [name=text]").fill("Погулял с собакой");
  await p.locator("[data-unit=percent]").click();
  await p.locator("#event-form [name=delta]").fill("5");
  await shot("event-form");
  await p.locator("#event-form button[type=submit]").click();
  await p.waitForSelector("dialog", { state: "detached" });
  const a = (await data()).id;
  assert.equal(
    (await p.locator(".main-value").innerText()).replace(/\s/g, ""),
    "1050",
  );
  await p.locator("#settings").click();
  await p.locator("[data-settings-tab=general]").click();
  await p.locator("#settings-form [name=initial]").fill("10000");
  await p.locator("#settings-form button[type=submit]").click();
  await p.waitForSelector("dialog", { state: "detached" });
  assert.equal(
    (await p.locator(".main-value").innerText()).replace(/\s/g, ""),
    "10500",
  );
  await p.locator("[data-edit]").first().click();
  assert.equal(await p.locator("#event-form [name=delta]").inputValue(), "5");
  assert.equal(
    await p.locator("#event-form [name=unit]").inputValue(),
    "percent",
  );
  await p.locator(".modal-close").click();
  await p.locator("#random-event").click();
  await p.waitForFunction(async () =>
    (await window.desktop.load()).journal.events.some((e) => e.test),
  );
  await home();
  await shot("menu");
  await p.locator("#new-graph").click();
  await p.locator("#new-graph-form [name=name]").fill("Тестовый график");
  await p.locator("#new-graph-form button[type=submit]").click();
  await p.waitForSelector("dialog", { state: "detached" });
  const b = (await data()).id;
  assert.notEqual(a, b);
  assert.equal((await data()).events.length, 0);
  await home();
  assert.equal(await p.locator(".graph-card").count(), 2);
  await p.locator("#home-demo").click();
  await p.waitForSelector("#exit-demo");
  assert.equal((await data()).id, b);
  await p.locator("#exit-demo").click();
  await home();
  await p.locator(`[data-open-graph="${a}"]`).click();
  await p.waitForSelector("#random-event");
  assert.equal((await data()).events.length, 7);
  await home();
  await p.locator("#clear-test-events").click();
  await p.locator("#confirm-reset").click();
  await p.waitForSelector("dialog", { state: "detached" });
  assert.equal((await data()).events.filter((e) => !e.deletedAt).length, 1);
  await p.waitForSelector("#new-graph");
  await shot("menu");
  await p.locator(`[data-open-graph="${a}"]`).click();
  await p.waitForSelector("#random-event");
  for (let i = 0; i < 10; i++) {
    await p.locator("#random-event").click();
    await p.waitForFunction(
      async (n) => (await window.desktop.load()).journal.events.length === n,
      13 + i * 6,
    );
  }
  await shot("chart");
  await home();
  await p.locator("#reset-graph").click();
  await p.locator("#cancel-reset").click();
  assert.equal((await data()).events.filter((e) => !e.deletedAt).length, 61);
  await p.locator("#reset-graph").click();
  await p.locator("#confirm-reset").click();
  await p.waitForSelector("dialog", { state: "detached" });
  assert.equal((await data()).events.filter((e) => !e.deletedAt).length, 0);
  await app.close();
  app = await launch();
  p = await app.firstWindow();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.waitForSelector("#first-event");
  await home();
  assert.equal(await p.locator(".graph-card").count(), 2);
  await p.locator(`[data-open-graph="${b}"]`).click();
  await p.waitForSelector("#first-event");
  assert.equal((await data()).id, b);
  assert.deepEqual(errors, []);
  console.log(
    "V1.4 UI PASS: window fit, compact form, 75/25 dates, percent rebase/edit, random entries, multiple graphs, menu/demo, safe reset, restart",
  );
} finally {
  await app.close();
}
