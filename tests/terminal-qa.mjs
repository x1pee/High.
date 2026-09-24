import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work"),
  shots = path.join(work, "terminal-qa");
await fs.mkdir(shots, { recursive: true });
const dir = await fs.mkdtemp(path.join(work, "terminal-profile-"));
const app = await electron.launch({
  executablePath: process.env.VYSHE_TEST_EXE,
  args: process.env.VYSHE_TEST_EXE ? [] : [root],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, VYSHE_DATA_DIR: dir },
});
const p = await app.firstWindow();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
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
try {
  await p.waitForSelector("#start-demo");
  await p.evaluate(() => document.fonts.ready);
  const fonts = await p.evaluate(() => ({
    family: getComputedStyle(document.body).fontFamily,
    loaded: [...document.fonts]
      .filter(
        (f) => f.family === '"Cascadia Code"' || f.family === "Cascadia Code",
      )
      .map((f) => ({ status: f.status, style: f.style })),
    cyrillic: document.fonts.check(
      '12px "Cascadia Code"',
      "Жизнь Ёжик рост 123",
    ),
  }));
  assert(fonts.family.includes("Cascadia"));
  assert(fonts.cyrillic);
  assert(fonts.loaded.some((f) => f.status === "loaded"));
  await shot("onboarding");
  await p.locator("#start-demo").click();
  await p.waitForSelector("#activity-content tbody");
  await shot("dark");
  assert.equal((await p.locator("#quick-move-down").innerText()).trim(), "");
  assert.equal((await p.locator("#quick-move-up").innerText()).trim(), "");
  assert.equal(await p.locator("#quick-move-down svg").count(), 1);
  assert.equal(await p.locator("#quick-move-up svg").count(), 1);
  await p.locator("#quick-move-up").click();
  await p.waitForFunction(() =>
    document.querySelector("#activity-content")?.innerText.includes("(x1)"),
  );
  const firstQuickEventCount = await p.locator("#day-panel .event-row").count();
  await p.locator("#quick-move-up").click();
  await p.waitForFunction(() =>
    document.querySelector("#day-panel .day-events")?.innerText.includes("(x2)"),
  );
  assert.equal(await p.locator("#day-panel .event-row").count(), firstQuickEventCount);
  await p.locator("#quick-move-down").click();
  await p.waitForFunction(() =>
    document.querySelector("#day-panel .day-events")?.innerText.includes("(x1)"),
  );
  assert.equal(await p.locator("#day-panel .event-row").count(), firstQuickEventCount + 1);
  await p.locator("#quick-move-down").click();
  await p.waitForFunction(() =>
    document.querySelector("#day-panel .day-events")?.innerText.includes("(x2)"),
  );
  assert.equal(await p.locator("#day-panel .event-row").count(), firstQuickEventCount + 1);
  await p.locator("#quick-move-up").click();
  await p.waitForFunction(() =>
    document.querySelector("#day-panel .day-events .event-row")?.innerText.includes("(x3)"),
  );
  assert.equal(await p.locator("#day-panel .event-row").count(), firstQuickEventCount + 1);
  const count = await p.locator(".activity-table tbody tr").count();
  assert(count > 0);
  await p.locator("[data-ledger=notes]").click();
  assert(await p.locator("#quick-note textarea").isVisible());
  await p.locator("[data-ledger=events]").click();
  await p.locator("[data-activity-date]").first().click();
  assert(await p.locator("#selected-date").inputValue());
  await p.locator("[data-chart-style=line]").click();
  assert((await p.locator("#chart-svg path").count()) > 0);
  await shot("line");
  await p.locator("#rail-focus").click();
  await p.keyboard.press("ArrowRight");
  assert(await p.locator("#hover-card").isVisible());
  await p.keyboard.press("Escape");
  await p.locator("#rail-expand").click();
  await p.waitForFunction(() =>
    document.body.classList.contains("chart-expanded"),
  );
  assert.equal(await p.locator("#day-panel").isVisible(), false);
  await p.locator("#rail-expand").click();
  assert(await p.locator("#day-panel").isVisible());
  await p.locator("[data-chart-style=candles]").click();
  await p.locator('[data-style-option="candles"]').click();
  await p.locator("[data-ledger=events]").click();
  await p.locator("#theme-toggle").click();
  await p.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await shot("light");
  for (const minutes of [1, 5, 15, 60, 240, 1440]) {
    await p.locator(`[data-interval="${minutes}"]`).click();
    assert(await p.locator("#chart-svg").isVisible());
  }
  await p.locator('[data-interval="5"]').click();
  await p.locator("#rhythm-toggle").uncheck();
  assert(
    (await p.locator(".chart-hint").innerText()).includes("без интерполяции"),
  );
  await p.locator("#rhythm-toggle").check();
  await shot("intraday");
  await p.locator("#rail-note").click();
  assert(await p.locator("#day-form").isVisible());
  await p.locator(".modal-close").click();
  for (const z of [1, 1.25, 1.5]) {
    await app.evaluate(({ BrowserWindow }, z) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.setSize(900, 700);
      w.webContents.setZoomFactor(z);
    }, z);
    await p.waitForFunction((z) => Math.abs(innerWidth - 902 / z) < 6, z);
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    assert(
      await p.locator(".demo-badge").isVisible(),
      "demo indicator remains visible at all scales",
    );
    await shot("compact-" + z);
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(shots, "result.json"),
    JSON.stringify({ passed: true, fonts, errors }, null, 2),
  );
  console.log("TERMINAL QA PASS", JSON.stringify(fonts));
} finally {
  await app.close();
}
