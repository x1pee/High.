import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createJournal, upsertEvent, localDate } from "../src/domain.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work");
const dir = await fs.mkdtemp(path.join(work, "v16-calendar-"));
let j = createJournal("Несколько лет", 1000);
for (const [date, delta] of [
  ["2021-03-10", 30],
  ["2022-07-05", -20],
  ["2023-11-20", 40],
  ["2024-02-29", 50],
  ["2025-06-07", -10],
  [localDate(), 20],
])
  j = upsertEvent(j, { date, delta, text: "Событие " + date, time: "00:00" });
await fs.writeFile(path.join(dir, "journal.json"), JSON.stringify(j));
const app = await electron.launch({
  executablePath: process.env.VYSHE_TEST_EXE,
  args: process.env.VYSHE_TEST_EXE ? [] : [root],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, VYSHE_DATA_DIR: dir },
});
try {
  const p = await app.firstWindow(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept().catch(() => {}));
  await p.locator('[data-interval="525600"]').click();
  const labels = await p
    .locator('.axis-label[text-anchor="middle"]')
    .allTextContents();
  assert(labels.length > 3);
  assert.equal(new Set(labels).size, labels.length);
  assert(labels.every((t) => /^\d{4}/.test(t)));
  const range = await p.locator("#range-label").innerText();
  assert((range.match(/\d{4}/g) ?? []).length === 2);
  await p.locator("#rail-focus").click();
  await p.keyboard.press("ArrowRight");
  assert((await p.locator("#hover-card .hover-top").innerText()).includes("—"));
  assert(
    (await p.locator("#hover-card .hover-events").innerText()).includes(
      "Событие " + localDate(),
    ),
  );
  await p.keyboard.press("Escape");
  await p.mouse.move(0, 0);
  await p.waitForFunction(() => !document.querySelector("#hover-card"));
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
    path.join(work, "v16-qa", "year.png"),
    Buffer.from(img, "base64"),
  );
  assert.equal(
    (await p.evaluate(async () => (await window.desktop.load()).journal)).events
      .length,
    6,
  );
  assert.deepEqual(errors, []);
  console.log(
    "CALENDAR UI PASS: distinct year labels, full range dates, aggregate event dates and unchanged records",
  );
} finally {
  await app.close();
}
