import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work");
const dir = await fs.mkdtemp(path.join(work, "v195-profile-")),
  shots = path.join(work, "v195-qa");
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
const attach = () => p.on("pageerror", (e) => errors.push(e.message));
attach();
const snapshot = () =>
  p.evaluate(async () => (await window.desktop.load()).journal);
const close = () => p.locator(".modal-close").click();
const idle = () => p.waitForSelector("dialog", { state: "detached" });
async function shot(name) {
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const base64 = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
      .toPNG()
      .toString("base64"),
  );
  await fs.writeFile(
    path.join(shots, name + ".png"),
    Buffer.from(base64, "base64"),
  );
}
const settings = async () => {
  await p.locator("#settings").click();
};
const general = async () => {
  await settings();
  await p.locator('[data-settings-tab="general"]').click();
};
const saveSettings = async () => {
  await p.locator('#settings-form .settings-save [type="submit"]').click();
  await idle();
};
async function add(text, amount = "5") {
  await p.locator("#add-event").click();
  await p.locator('[name="text"]').fill(text);
  await p.locator('[name="delta"]').fill(amount);
  await p.locator('#event-form [type="submit"]').click();
  await idle();
}
try {
  await p.waitForSelector("#application-form");
  await p.locator('#application-form [type="submit"]').click();
  await idle();
  await p.waitForSelector("#start-form");
  await p.locator('#start-form [name="name"]').fill("BTK · Первый график");
  await p.locator('[name="starterMode"][value="visual"]').check();
  await shot("start-choice");
  await p.locator('#start-form [type="submit"]').click();
  await p.waitForSelector("#coin-form");
  await p.locator("#coin-later").click();
  await idle();
  await p.waitForSelector("#starter-banner");
  assert.equal((await snapshot()).events.length, 0);
  assert.equal(await p.locator(".chart-candle").count(), 30);
  assert.equal(await p.locator('[data-interval="60"]').getAttribute("aria-pressed"), "true");
  assert.match(await p.locator("#starter-banner").innerText(), /Скрыть стартовый ритм/);
  assert.equal(
    await p.locator('#volume-layer [data-volume-count="0"]').count(),
    30,
  );
  assert.equal(await p.locator("#chart-empty").isVisible(), false);
  await shot("starter");
  // Selecting an example closes its panel and jumps straight to the amount.
  await p.locator("#add-event").click();
  await p.locator(".event-examples summary").click();
  await p.locator(".example-results button").first().click();
  assert.equal(await p.locator(".event-examples").evaluate((el) => el.open), false);
  await p.waitForFunction(() => document.activeElement?.name === "delta");
  await p.locator('[name="text"]').fill("");
  // Sign is editable; typing or pasting text cannot get into the numeric field.
  const amount = p.locator('[name="delta"]');
  assert.equal(await p.locator('[name="text"]').getAttribute("required"), null);
  assert.equal(await amount.getAttribute("inputmode"), "decimal");
  await amount.fill("-5");
  await amount.focus();
  await p.keyboard.press("Home");
  await p.keyboard.press("Delete");
  assert.equal(await amount.inputValue(), "5");
  assert.equal(
    await p.locator('[data-delta-sign="1"]').getAttribute("aria-pressed"),
    "true",
  );
  await p.keyboard.press("End");
  await p.keyboard.type("abc");
  assert.equal(await amount.inputValue(), "5");
  await amount.fill("Переживаю за Соню");
  assert.equal(await amount.inputValue(), "5");
  await amount.fill("-1,25");
  assert.equal(
    await p.locator('[data-delta-sign="-1"]').getAttribute("aria-pressed"),
    "true",
  );
  await amount.fill("0");
  assert.equal(
    await p.locator('[data-delta-sign="1"]').getAttribute("aria-pressed"),
    "true",
  );
  await p.locator('[name="text"]').fill("Первый настоящий момент");
  await amount.fill("5");
  await p.locator('[data-event-time="custom"]').click();
  assert(await p.locator(".date-picker").isVisible());
  assert(await p.locator(".time-picker").isVisible());
  assert.equal(await p.locator('.time-picker input[type="time"]').count(), 0);
  await p.locator('[name="pickDate"]').fill("2025-02-28");
  await p.locator('[data-time-hour="04"]').click();
  await p.locator('[data-time-minute="30"]').click();
  assert.equal(await p.locator('[name="date"]').inputValue(), "2025-02-28");
  assert.equal(await p.locator('[name="time"]').inputValue(), "04:30");
  await shot("date-time");
  // Use yesterday so the test remains safe across midnight.
  const yesterday = await p.evaluate(() => {
    let d = new Date();
    d.setDate(d.getDate() - 1);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ];
  });
  await p.locator('[name="pickDate"]').fill(yesterday.join("-"));
  await p.locator('[name="text"]').fill("");
  await p.locator('#event-form [type="submit"]').click();
  await idle();
  await p.waitForFunction(
    () =>
      document.querySelector("#chart")?.dataset.eventAnimation === "playing",
  );
  assert.equal(
    await p.locator(".chart-candle").evaluateAll((els) => els.some((el) => el.style.opacity === "0.28")),
    true,
  );
  assert(
    await p.evaluate(() =>
      document.getAnimations().some((a) => a.effect?.getTiming().duration >= 1150),
    ),
    "new event impulse is slow enough to follow",
  );
  assert(
    await p.evaluate(() =>
      document
        .getAnimations()
        .some(
          (a) =>
            a.effect?.target?.isConnected && a.effect.target.closest("#chart"),
        ),
    ),
    "animation targets visible chart",
  );
  await shot("animation");
  await p.waitForFunction(
    () => !document.querySelector("#chart")?.dataset.eventAnimation,
  );
  let j = await snapshot();
  assert.equal(j.events.length, 1);
  assert.equal(j.events[0].text, "Без описания");
  assert.equal(j.settings.starter.remaining, 29);
  assert.equal(j.events[0].time, "04:30");
  assert(
    (await p.locator('#volume-layer [data-volume-count="1"]').count()) >= 1,
  );
  assert.equal(
    await p.locator('#volume-layer [data-volume-count="1"]').first().evaluate((el) => el.tagName.toLowerCase()),
    "rect",
  );
  await p.locator("#starter-hide").click();
  await p.waitForFunction(() => document.querySelector("#starter-banner")?.hidden);
  assert.equal((await snapshot()).events.length, 1);
  // Fifteen presets + custom; modern marks and conditional 5-letter editor.
  await general();
  assert.equal(await p.locator("[data-coin-color]").count(), 15);
  assert.equal(await p.locator("[data-coin-custom]").count(), 1);
  await p.locator('[name="coinLabel"]').fill("BTK");
  await p.locator('[data-coin-symbol="prism"]').click();
  assert.equal(await p.locator('[name="coinLabel"]').isVisible(), false);
  // Suppress only the native color chooser in QA, then exercise the visible HEX editor.
  await p
    .locator('[name="coinCustom"]')
    .evaluate((el) => el.addEventListener("click", (e) => e.preventDefault()));
  await p.locator("[data-coin-custom]").click();
  await p.locator('[name="coinHex"]').fill("#ab67ef");
  await p.locator('[name="rhythmStrength"]').selectOption("8");
  await shot("coin");
  await saveSettings();
  j = await snapshot();
  assert.equal(j.settings.coin.color, "#ab67ef");
  assert.equal(j.settings.coin.label, "BTK");
  assert.equal(j.settings.rhythmStrength, 8);
  await settings();
  await p.locator('[data-preset="terminal"]').click();
  await p.waitForFunction(
    async () =>
      (await window.desktop.load()).journal.settings.appearance?.palette ===
      "blue",
  );
  const vars = () =>
    p.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return [
        s.getPropertyValue("--up").trim(),
        s.getPropertyValue("--value").trim(),
        s.getPropertyValue("--accent").trim(),
      ];
    });
  let v = await vars();
  assert.equal(v[0], "#16c784");
  assert.equal(v[0], v[1]);
  await p.locator('[name="chartColors"]').selectOption("theme");
  v = await vars();
  assert.equal(v[0], v[2]);
  assert.equal(v[1], v[2]);
  await p.locator('[name="chartColors"]').selectOption("custom");
  await p.locator('[name="color-up"]').fill("#19ce9e");
  await p.locator('[name="color-up"]').dispatchEvent("input");
  assert.equal((await vars())[0], "#19ce9e");
  await p.locator("#custom-from-theme").click();
  await shot("theme");
  await close();
  await idle();
  await p.waitForFunction(
    async () =>
      (await window.desktop.load()).journal.settings.appearance.colors.up ===
      "#19ce9e",
  );
  await general();
  await p.locator('[name="motion"]').check();
  await saveSettings();
  await add("Без анимации", "1");
  assert.equal(
    await p.locator('#chart[data-event-animation="playing"]').count(),
    0,
  );
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setBounds({ width: 1100, height: 850 });
    w.webContents.setZoomFactor(1.25);
  });
  await general();
  assert(
    await p
      .locator("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    "compact settings do not overflow",
  );
  await shot("compact-settings");
  await close();
  await idle();
  await shot("compact-chart");
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.webContents.setZoomFactor(1);
    w.setBounds({ width: 1600, height: 1080 });
  });
  // A body overlay must neither intercept a drag nor freeze scanning through it.
  await p.locator('[data-interval="15"]').click();
  const candle = p.locator(".chart-candle").last().locator(".candle-body");
  await candle.hover();
  await p.waitForSelector("#hover-card");
  const card = await p.locator("#hover-card").boundingBox();
  const hit = await p.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest("#hover-card") !== null,
    { x: card.x + 50, y: card.y + 140 },
  );
  assert.equal(hit, false);
  const before = await p.locator("#range-label").innerText();
  await p.mouse.move(card.x + 50, card.y + 140);
  await p.mouse.down();
  await p.mouse.move(card.x + 160, card.y + 140, { steps: 8 });
  await p.mouse.up();
  assert.equal(await p.locator("#hover-card").count(), 0);
  assert.notEqual(await p.locator("#range-label").innerText(), before);
  await p.locator("#today").click();
  await p.locator("#show-volume").click();
  await p.waitForSelector("#volume-layer", { state: "detached" });
  await p.locator("#show-volume").click();
  await p.waitForSelector("#volume-layer");
  // Menu actions delete inactive, active, then last. No production profile involved.
  const firstId = (await snapshot()).id;
  await p.locator("#home-button").click();
  await p.locator("#new-graph").click();
  await p.locator('#new-graph-form [name="name"]').fill("Second");
  await p.locator('[name="starterMode"][value="manual"]').check();
  await p.locator('#new-graph-form [type="submit"]').click();
  await p.waitForSelector("#coin-form");
  await p.locator("#coin-later").click();
  await idle();
  assert.equal(await p.locator("#chart-empty").isVisible(), true);
  await p.locator("#home-button").click();
  const firstCard = p
    .locator(".graph-card")
    .filter({ has: p.locator(`[data-delete-graph="${firstId}"]`) });
  await firstCard.locator("summary").click();
  await firstCard.locator("[data-delete-graph]").click();
  await p.locator("#confirm-delete-graph").click();
  await idle();
  assert.equal((await p.evaluate(() => window.desktop.graphs())).length, 1);
  await p.locator(".graph-card summary").click();
  await p.locator("[data-edit-graph]").click();
  await p.waitForSelector("#coin-form");
  await p.locator("#coin-later").click();
  await idle();
  await p.locator(".graph-card summary").click();
  await p.locator("[data-delete-graph]").click();
  await p.locator("#confirm-delete-graph").click();
  await idle();
  await p.waitForSelector("#start-form");
  assert.equal(await snapshot(), null);
  await app.close();
  app = await launch();
  p = await app.firstWindow();
  attach();
  await p.waitForSelector("#start-form");
  assert.equal(await snapshot(), null);
  assert.equal(
    (await fs.readdir(path.join(dir, "deleted-graphs"))).filter((n) =>
      n.endsWith(".json"),
    ).length,
    2,
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "V195 UI PASS: optional starter, sign deletion, numeric-only, date/time lists, event animation, real volume, coin custom HEX/letters, theme modes, card pass-through drag, graph deletion and restart",
  );
} catch (e) {
  console.log("UI errors", errors);
  await shot("failure");
  throw e;
} finally {
  await app.close();
}
