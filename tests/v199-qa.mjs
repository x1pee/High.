import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work");
const dir = await fs.mkdtemp(path.join(work, "v199-profile-")),
  shots = path.join(work, "v199-qa");
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
const snap = () =>
  p.evaluate(async () => (await window.desktop.load()).journal);
const shot = async (name) => {
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(250);
  const base64 = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
      .toPNG()
      .toString("base64"),
  );
  await fs.writeFile(
    path.join(shots, name + ".png"),
    Buffer.from(base64, "base64"),
  );
};
const idle = () => p.waitForSelector("dialog", { state: "detached" });
const dateOffset = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
async function event(text, delta, date) {
  await p.locator("#add-event").click();
  await p.locator("[name=text]").fill(text);
  await p.locator("[name=delta]").fill(delta);
  if (date) {
    await p.locator("[data-event-time=custom]").click();
    await p.locator("[name=pickDate]").fill(date);
    await p.locator('[data-time-hour="12"]').click();
    await p.locator('[data-time-minute="00"]').click();
  }
  return p.locator("#event-form [type=submit]");
}
try {
  await p.waitForSelector("#application-form");
  await shot("first-launch");
  await p.locator("#application-form [type=submit]").click();
  await idle();
  assert.equal(
    await p.locator("#start-form [name=name]").inputValue(),
    "LIFEUSDT",
  );
  assert.equal(
    await p.locator("#start-form [name=initial]").inputValue(),
    "100",
  );
  assert(await p.locator("[name=starterMode][value=visual]").isChecked());
  assert.equal(await p.locator(".start-coin").count(), 0);
  await shot("onboarding");
  await p.locator("#start-form [type=submit]").click();
  await p.waitForSelector("#coin-form");
  assert(await p.locator("#chart").isVisible());
  await shot("coin");
  const letters = p.locator("[name=coinLabel]");
  await letters.fill("WWWWW");
  assert(await p.locator('.coin-preview text').evaluate(el => el.getBBox().width <= 46));
  await letters.fill("SOLO");
  const before = await p.locator(".coin-editor").boundingBox();
  const dialogTop = (await p.locator(".coin-modal").boundingBox()).y;
  await p.locator("[data-coin-symbol=link]").click();
  const after = await p.locator(".coin-editor").boundingBox();
  assert(after.height < before.height, "unused letters no longer reserve blank space");
  assert(Math.abs((await p.locator(".coin-modal").boundingBox()).y - dialogTop) < 2);
  await p.locator("[data-coin-symbol=initials]").click();
  await p.locator("#coin-form [type=submit]").click();
  await idle();
  assert.equal((await snap()).events.length, 0);
  assert.equal(await p.locator(".chart-candle").count(), 30);
  assert.equal(await p.locator(".value-unit").count(), 0);
  await p.locator("#settings").click();
  await p.locator('[data-settings-tab="application"]').click();
  await p.waitForFunction(() => !document.querySelector("#save-application-settings").disabled);
  assert(await p.locator("#app-tray-setting").isHidden());
  await shot("application-settings");
  await p.locator('[name="appAutoStart"]').check();
  assert(await p.locator("#app-tray-setting").isVisible());
  await p.locator('[name="appTray"]').check();
  await p.locator("#save-application-settings").click();
  await p.waitForFunction(async () => {
    const prefs = await window.desktop.preferences();
    return prefs.autoStart && prefs.tray;
  });
  await p.locator('[name="appAutoStart"]').uncheck();
  assert(await p.locator("#app-tray-setting").isHidden());
  assert.equal(await p.locator('[name="appTray"]').isChecked(), false);
  await p.locator("#save-application-settings").click();
  await p.waitForFunction(async () => {
    const prefs = await window.desktop.preferences();
    return !prefs.autoStart && !prefs.tray;
  });
  await p.locator(".modal-close").click();
  await shot("starter");
  let submit = await event("Первый момент", "-10");
  const amount = p.locator("[name=delta]");
  await amount.pressSequentially("abc");
  assert.equal(await amount.inputValue(), "-10");
  assert.equal(await amount.getAttribute("inputmode"), "decimal");
  await p.evaluate(() => {
    const original = Element.prototype.animate;
    window.animationTargets = [];
    Element.prototype.animate = function (...args) {
      window.animationTargets.push({
        index: this.dataset.candleIndex,
        recorded: this.dataset.recorded,
      });
      return original.apply(this, args);
    };
  });
  await submit.click();
  await idle();
  await p.waitForTimeout(150);
  await shot("animation");
  let targets = await p.evaluate(() =>
    window.animationTargets.filter((t) => t.index !== undefined),
  );
  assert(targets.length > 0);
  assert(
    targets.every((t) => t.recorded === "true"),
    "starter must not animate",
  );
  await p.waitForTimeout(1000);
  let j = await snap();
  assert.equal(j.events.length, 1);
  assert.equal(j.events[0].delta, -10);
  submit = await event("Прошлая неделя", "5", dateOffset(-7));
  await shot("date-time");
  await submit.click();
  await idle();
  await p.waitForTimeout(250);
  assert.equal((await snap()).events.length, 2);
  assert((await p.locator(".chart-candle[data-recorded=true]").count()) > 0);
  assert(
    (await p.locator(".day-panel").innerText()).includes("Прошлая неделя"),
  );
  await shot("backdated");
  // Back to now must hide both date and time.
  submit = await event("Будущее", "3", dateOffset(2));
  await p.locator("[data-event-time=now]").click();
  assert(!(await p.locator("[name=pickDate]").isVisible()));
  assert(!(await p.locator(".time-picker").isVisible()));
  await p.locator("[data-event-time=custom]").click();
  await p.locator("[name=pickDate]").fill(dateOffset(2));
  await p.locator('[data-time-hour="12"]').click();
  await p.locator('[data-time-minute="00"]').click();
  await submit.click();
  assert.equal((await snap()).events.length, 2);
  assert((await p.locator(".form-error").innerText()).includes("два раза"));
  await submit.click();
  assert.equal((await snap()).events.length, 2);
  assert((await p.locator(".form-error").innerText()).includes("один раз"));
  await submit.click();
  await idle();
  assert.equal((await snap()).events.length, 3);
  await p.waitForTimeout(1000);
  assert((await p.locator(".chart-candle[data-recorded=true]").count()) > 0);
  await shot("future");
  await p.locator("#updates").click();
  assert(
    (await p.locator("#update-status").innerText()).includes("не опубликован"),
  );
  await p.locator("#check-update").click();
  await shot("updates");
  await p.locator(".modal-close").click();
  await p.locator("#home-button").click();
  await p.waitForSelector("#new-graph");
  assert.equal(
    await p.getByText("Для тестирования", { exact: true }).count(),
    0,
  );
  await p.locator(".graph-actions summary").click();
  await shot("menu");
  await p.locator("[data-delete-graph]").click();
  await p.locator("#confirm-delete-graph").click();
  await p.waitForSelector("#start-form");
  assert.equal(await snap(), null);
  await p
    .getByRole("button", { name: "Восстановить удалённый график" })
    .click();
  await p.waitForSelector("[data-restore]");
  await shot("archive");
  await p.locator("[data-restore]").click();
  await idle();
  assert.equal((await snap()).events.length, 3);
  await app.close();
  app = await launch();
  p = await app.firstWindow();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.waitForSelector("#chart");
  assert.equal(await p.locator("#application-form").count(), 0);
  assert.equal((await snap()).events.length, 3);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1000, 750),
  );
  await p.locator(".instrument-coin").click();
  await shot("coin-compact");
  assert(
    await p.evaluate(() => {
      const d = document.querySelector("dialog");
      return d.scrollWidth <= d.clientWidth + 1;
    }),
  );
  await p.locator(".modal-close").click();
  submit = await event("Рост в той же свече", "50");
  await submit.click();
  await idle();
  await p.waitForTimeout(1100);
  submit = await event("Спад при суммарном росте", "-20");
  await submit.click();
  await idle();
  await p.waitForSelector("[data-event-impulse]");
  assert.equal(
    await p.locator("[data-event-impulse] rect").getAttribute("fill"),
    "var(--down)",
  );
  const index = await p
    .locator("[data-event-impulse]")
    .getAttribute("data-candle-index");
  assert(
    (
      await p
        .locator(`.chart-candle[data-candle-index="${index}"]`)
        .getAttribute("style")
    ).includes("var(--up)"),
  );
  await shot("negative-impulse");
  await p.waitForTimeout(1000);
  await p.waitForSelector("[data-event-impulse]", { state: "detached", timeout: 4000 });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        passed: true,
        profile: dir,
        checks:
          "first launch, defaults, coin stable layout, numeric input, no starter animation, past/future entries, now hides fields, updates, archive/restore, restart, compact",
      },
      null,
      2,
    ),
  );
} catch (e) {
  await shot("failure").catch(() => {});
  throw e;
} finally {
  await app.close();
}
