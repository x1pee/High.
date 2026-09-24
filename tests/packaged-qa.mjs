import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work");
const dir = await fs.mkdtemp(path.join(work, "packaged-qa-"));
const shots = path.join(work, "packaged-shots");
await fs.mkdir(shots, { recursive: true });
const app = await electron.launch({
  executablePath:
    process.env.VYSHE_TEST_EXE ||
    path.join(work, "build/win-unpacked/Vyshe.exe"),
  timeout: 45000,
  args: [],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, VYSHE_DATA_DIR: dir },
});
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function shot(name) {
  await page.mouse.move(0, 0);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const image = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage())
      .toPNG()
      .toString("base64"),
  );
  await fs.writeFile(
    path.join(shots, name + ".png"),
    Buffer.from(image, "base64"),
  );
}
try {
  await page.waitForSelector("#start-demo");
  await shot("welcome");
  await page.locator("#start-demo").click();
  await page.waitForSelector("#chart");
  await shot("dark");
  await page.locator("#theme-toggle").click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await shot("light");
  await page.locator("#chart").focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForSelector("#hover-card");
  await shot("focus");
  await page.keyboard.press("Escape");
  await page.locator('[data-interval="15"]').click();
  await shot("intraday");
  for (const zoom of [1, 1.25, 1.5]) {
    await app.evaluate(({ BrowserWindow }, zoom) => {
      const b = BrowserWindow.getAllWindows()[0];
      b.setSize(900, 700);
      b.webContents.setZoomFactor(zoom);
    }, zoom);
    await page.waitForFunction((z) => Math.abs(innerWidth - 902 / z) < 5, zoom);
    await shot("compact-" + zoom);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PACKAGED QA PASS",
    JSON.stringify({ dataDirectory: dir, errors }),
  );
} finally {
  await app.close();
}
