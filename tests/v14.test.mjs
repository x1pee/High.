import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GraphLibrary } from "../desktop/library.cjs";
import {
  createJournal,
  upsertEvent,
  validateJournal,
  calculate,
} from "../src/domain.mjs";
const add = (j, delta, unit = "percent") =>
  upsertEvent(j, {
    text: "Событие",
    date: "2026-09-20",
    time: "12:00",
    delta,
    unit,
  });
test("Percentage intent survives rebasing, point amounts stay fixed, subsequent percentages compound", () => {
  let j = add(createJournal("A", 1000), 5);
  assert.equal(calculate(j)[0].close, 1050);
  j.settings.initial = 10000;
  assert.equal(calculate(j)[0].close, 10500);
  assert.equal(calculate(j)[0].events[0].percent, 5);
  j = add(j, 5, "points");
  j = add(j, 10);
  assert.equal(calculate(j)[0].close, 11555.5);
  assert.equal(calculate(j)[0].events[1].delta, 5);
  assert.deepEqual(validateJournal(JSON.parse(JSON.stringify(j))), j);
});
test("Legacy amounts migrate as points; invalid units and compounded overflow reject", () => {
  const j = add(createJournal(), 50);
  j.schemaVersion = 1;
  const migrated = validateJournal(j);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.events[0].unit, "points");
  assert.equal(calculate(migrated)[0].close, 1050);
  migrated.events[0].unit = "unknown";
  assert.throws(() => validateJournal(migrated));
  let huge = createJournal("A", 1e9);
  for (let i = 0; i < 30; i++) huge = add(huge, 100);
  assert.throws(() => validateJournal(huge));
});
test("Graph library preserves legacy active file, switches, imports and restarts; failures retain current graph", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vyshe-v14-"));
  let a = add(createJournal("A", 1000), 5);
  a.schemaVersion = 1;
  await fs.writeFile(path.join(dir, "journal.json"), JSON.stringify(a));
  const lib = new GraphLibrary(dir, validateJournal);
  await lib.init();
  assert.equal(lib.current.events[0].unit, "points");
  const b = await lib.create(createJournal("B", 500));
  assert.equal((await lib.list()).length, 2);
  a = await lib.open(a.id);
  assert.equal(a.events.length, 1);
  await assert.rejects(lib.save(b, a.revision));
  const atomic = lib.store.atomic;
  lib.store.atomic = async () => {
    throw new Error("disk failure");
  };
  await assert.rejects(lib.open(b.id));
  assert.equal(lib.current.id, a.id);
  lib.store.atomic = atomic;
  await lib.open(b.id);
  const again = new GraphLibrary(dir, validateJournal);
  await again.init();
  assert.equal(again.current.id, b.id);
  assert.equal((await again.open(a.id)).events.length, 1);
  const imported = createJournal("Imported", 200);
  await again.save(imported, again.current.revision, true);
  assert.equal((await again.list()).length, 3);
  assert.equal((await again.open(a.id)).events.length, 1);
});
