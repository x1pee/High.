import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createJournal, shiftDate, localDate } from "../src/domain.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  work = path.resolve(root, "../../work");
const dir = await fs.mkdtemp(path.join(work, "performance-qa-"));
const j = createJournal("Пять лет истории", 1000),
  stamp = new Date().toISOString();
for (let i = 0; i < 18000; i++)
  j.events.push({
    id: "event-" + i,
    date: shiftDate(localDate(), Math.floor(i / 10) - 1799),
    time: "12:00",
    text: "Тест производительности",
    delta: i % 2 ? -0.1 : 0.2,
    order: i,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  });
await fs.writeFile(path.join(dir, "journal.json"), JSON.stringify(j));
const app = await electron.launch({
  args: [root],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, VYSHE_DATA_DIR: dir },
});
try {
  const p = await app.firstWindow();
  await p.waitForSelector("#chart");
  const start = performance.now();
  for (let i = 0; i < 8; i++) await p.locator("#zoom-out").click();
  await p.waitForFunction(
    () => document.querySelectorAll("#chart-svg rect").length >= 1800,
  );
  const elapsed = performance.now() - start;
  assert(elapsed < 5000);
  await p.locator('[data-interval="1"]').click();
  await p.waitForSelector('[data-interval="1"][aria-pressed="true"]');
  console.log(
    "PERFORMANCE QA PASS",
    JSON.stringify({
      events: 18000,
      days: 1800,
      showAllMilliseconds: Math.round(elapsed),
    }),
  );
} finally {
  await app.close();
}
