import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work"),
  shots = path.join(work, "feedback-qa");
await fs.mkdir(shots, { recursive: true });
const dir = await fs.mkdtemp(path.join(work, "feedback-profile-"));
let app = await electron.launch({
  executablePath: process.env.VYSHE_TEST_EXE,
  args: process.env.VYSHE_TEST_EXE ? [] : [root],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, VYSHE_DATA_DIR: dir },
});
let p = await app.firstWindow();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("dialog", (d) => d.accept().catch(() => {}));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
async function shot(name) {
  await p.mouse.move(0, 0);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
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
const css = (key) =>
  p.evaluate(
    (key) =>
      getComputedStyle(document.documentElement).getPropertyValue(key).trim(),
    key,
  );
const persisted = async () =>
  JSON.parse(await fs.readFile(path.join(dir, "journal.json"), "utf8"));
const waitPalette = (palette) =>
  p.waitForFunction(
    async (palette) =>
      (await window.desktop.load()).journal.settings.appearance?.palette ===
      palette,
    palette,
  );
try {
  await p.waitForSelector("#application-form");
  await p.locator('#application-form [type="submit"]').click();
  await p.waitForSelector("dialog", { state: "detached" });
  await p.waitForSelector("#start-form");
  assert.equal(await css("--accent"), "#f7a924");
  await p.locator('[name="starterMode"][value="manual"]').check();
  await p.locator("#start-form button[type=submit]").click();
  await p.waitForSelector("#coin-form");
  await p.locator("#coin-later").click();
  await p.waitForSelector("dialog", { state: "detached" });
  await p.waitForSelector(".overview");
  for (const interval of [1440, 1, 5, 15, 60, 240]) {
    await p.locator(`[data-interval="${interval}"]`).click();
    assert.equal(await p.locator("#chart-svg").innerHTML(), "");
    await p.locator("#first-event").click();
    assert(await p.locator("#event-form").isVisible());
    await p.locator(".modal-close").click();
  }
  await shot("empty-chart");
  await p.locator("#settings").click();
  assert.equal(await p.locator(".settings-save").isVisible(), false);
  await p.locator("[data-preset=forest]").click();
  assert.equal(await css("--bg"), "#101114");
  await p.mouse.click(8, 120);
  await p.waitForSelector("dialog", { state: "detached" });
  await waitPalette("green");
  assert.equal((await persisted()).settings.appearance.palette, "green");
  await p.locator("#settings").click();
  // Rapid independent input events must serialize without stale-revision losses.
  await p.evaluate(() => {
    for (const id of ["night", "graphite", "terminal", "forest", "night"])
      document.querySelector(`[data-preset="${id}"]`).click();
  });
  await p.keyboard.press("Escape");
  await p.waitForSelector("dialog", { state: "detached" });
  await waitPalette("amber");
  assert.equal(await css("--accent"), "#f7a924");
  await p.locator("#settings").click();
  await p.locator("[data-preset=custom]").click();
  for (const [key, value] of Object.entries({
    accent: "#75baff",
    up: "#23cc88",
    down: "#ff6579",
    value: "#dab0ff",
  })) {
    await p.locator(`[name="color-${key}"]`).evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  }
  await p.mouse.click(8, 120);
  await p.waitForFunction(
    async () =>
      (await window.desktop.load()).journal.settings.appearance?.colors
        ?.value === "#dab0ff",
  );
  await app.close();
  app = await electron.launch({
    executablePath: process.env.VYSHE_TEST_EXE,
    args: process.env.VYSHE_TEST_EXE ? [] : [root],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined,
      VYSHE_DATA_DIR: dir,
    },
  });
  p = await app.firstWindow();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  await p.waitForSelector(".overview");
  assert.equal(await css("--value"), "#dab0ff");
  await p.locator("#first-event").click();
  await p.locator("#event-form [name=delta]").fill("5");
  const amount = await p.locator("#event-form [name=delta]").boundingBox();
  await p.mouse.move(amount.x + amount.width / 2, amount.y + amount.height / 2);
  await p.mouse.down();
  await p.mouse.move(5, amount.y + amount.height / 2, { steps: 15 });
  await p.mouse.up();
  assert(await p.locator("#event-form").isVisible());
  await p.mouse.click(8, 120);
  await p.keyboard.press("Escape");
  assert(await p.locator("#event-form").isVisible());
  assert.equal(await p.locator(".quick-ideas").count(), 0);
  assert(
    (
      await p.locator("#event-form [name=text]").getAttribute("placeholder")
    ).startsWith("Например, "),
  );
  assert.equal(await p.locator("[data-event-time]").count(), 2);
  await p.locator(".event-examples summary").click();
  assert.equal(await p.locator(".example-results button").count(), 500);
  await p.locator("#example-search").fill("зарплат");
  await p.locator("#example-search").press("Enter");
  assert(await p.locator("#event-form").isVisible());
  await p
    .getByRole("button", { name: "Получил зарплату", exact: true })
    .click();
  assert.equal(
    await p.locator("#event-form [name=text]").inputValue(),
    "Получил зарплату",
  );
  await p.waitForFunction(
    () =>
      !document.querySelector(".event-examples").open &&
      document.activeElement?.name === "delta",
  );
  await p.locator(".event-examples summary").click();
  await p.locator("#example-search").fill("");
  await p.locator('[data-example-category="Отдых"]').click();
  assert.equal(await p.locator(".example-results button").count(), 50);
  await shot("examples");
  await p.locator(".event-examples summary").click();
  await p.locator("[data-unit=percent]").click();
  await p.locator("#event-form [name=delta]").fill("2");
  assert((await p.locator("#impact-preview").innerText()).includes("+2"));
  await p.locator("[data-event-time=custom]").click();
  await p.locator("#event-form [name=pickDate]").fill("2026-09-01");
  await p.locator("#event-form [name=pickDate]").press("Tab");
  assert.equal(
    await p.locator("#event-form [name=date]").inputValue(),
    "2026-09-01",
  );
  await p.locator("[data-event-time=now]").click();
  assert.equal(await p.locator("#event-form .date-picker").isVisible(), false);
  assert.equal(await p.locator("#event-form .time-picker").isVisible(), false);
  await p.locator("[data-event-time=custom]").click();
  await p.locator('#event-form [data-time-hour="00"]').click();
  await p.locator('#event-form [name="pickMinute"]').evaluate((input) => { input.value = "5"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  assert(await p.locator("#event-form [name=time]").inputValue());
  await p.locator("[data-event-time=now]").click();
  await shot("event-form");
  await p.locator("#event-form button[type=submit]").click();
  await p.waitForSelector("dialog", { state: "detached" });
  assert.equal(
    (await p.locator(".main-value").innerText()).replace(/\s/g, ""),
    "102",
  );
  let j = await persisted();
  assert.equal(j.events[0].delta, 2);
  assert.equal(j.events[0].unit, "percent");
  assert.equal(j.events[0].text, "Получил зарплату");
  await p.locator('[data-interval="60"]').click();
  await p.locator("#rail-focus").click();
  await p.keyboard.press("ArrowRight");
  assert(
    (await p.locator(".hover-delta").innerText({ timeout: 3000 })).includes(
      "+2",
    ),
  );
  await p.keyboard.press("Escape");
  await p.locator("#previous").click();
  assert.equal(await p.locator("#chart-svg").innerHTML(), "");
  await p.locator("#first-event").click();
  assert(await p.locator("#event-form").isVisible());
  await p.locator(".modal-close").click();
  await p.locator("#today").click();
  for (const z of [1, 1.25, 1.5]) {
    await p.locator("#add-event").click();
    await app.evaluate(({ BrowserWindow }, z) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.setSize(900, 700);
      w.webContents.setZoomFactor(z);
    }, z);
    await p.waitForFunction((z) => Math.abs(innerWidth - 902 / z) < 6, z);
    assert.equal(
      await p
        .locator("dialog")
        .evaluate((el) => el.scrollWidth > el.clientWidth + 1),
      false,
    );
    await p.locator("#event-form button[type=submit]").scrollIntoViewIfNeeded();
    await shot("compact-" + z);
    await p.locator(".modal-close").click();
  }
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setSize(1440, 960);
    w.webContents.setZoomFactor(1);
  });
  await p.locator("#settings").click();
  await p.locator("[data-settings-tab=data]").click();
  await p.locator("#demo-from-settings").click();
  await p.locator("#settings").click();
  await p.locator("[data-preset=night]").click();
  await p.mouse.click(8, 120);
  await waitPalette("amber");
  await p.locator('[data-interval="1440"]').click();
  await shot("dense-chart");
  const widths = await p
    .locator(".candle-body")
    .evaluateAll((es) => es.map((e) => +e.getAttribute("width")));
  assert(widths.length > 30 && widths.every((w) => w >= 1 && w <= 22));
  assert.equal(
    (await persisted()).settings.appearance.colors.value,
    "#dab0ff",
    "demo must not change personal theme",
  );
  assert.deepEqual(errors, []);
  console.log(
    "FEEDBACK QA PASS: empty state, first event, theme autosave/restart/burst, real drag-outside, examples, selectors, dates, actual tooltip, sparse days and responsive forms",
  );
} catch (error) {
  console.log("JS errors", errors);
  console.log("QA failure state", await p.locator("body").innerText());
  throw error;
} finally {
  await app.close();
}
