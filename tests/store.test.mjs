import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { JournalStore } from "../desktop/store.cjs";
import { createJournal, validateJournal, upsertEvent } from "../src/domain.mjs";
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vyshe-test-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new JournalStore(dir, validateJournal);
  await store.init();
  return { store, dir };
}
test("Persistent save, restart and backup round-trip", async (t) => {
  const { store, dir } = await fixture(t);
  let j = await store.save(createJournal(), 0);
  j = await store.save(
    upsertEvent(j, {
      date: "2026-09-20",
      time: "12:00",
      text: "тест",
      delta: 2,
    }),
    j.revision,
  );
  const other = new JournalStore(dir, validateJournal);
  assert.deepEqual((await other.init()).journal, j);
  assert.equal((await fs.readdir(store.backups)).length, 1);
});
test("Corrupt primary recovers a validated backup and preserves the damaged file", async (t) => {
  const { store, dir } = await fixture(t);
  let j = await store.save(createJournal(), 0);
  await store.save(
    upsertEvent(j, {
      date: "2026-09-20",
      time: "12:00",
      text: "тест",
      delta: 2,
    }),
    j.revision,
  );
  await fs.writeFile(store.file, "bad");
  const other = new JournalStore(dir, validateJournal),
    result = await other.init();
  assert(result.notice);
  assert.equal(result.journal.events.length, 0);
  assert((await fs.readdir(dir)).some((f) => f.startsWith("damaged-")));
});
test("Invalid import cannot modify existing persisted data", async (t) => {
  const { store } = await fixture(t);
  await store.save(createJournal(), 0);
  const before = await fs.readFile(store.file, "utf8");
  await assert.rejects(store.save({ schemaVersion: 999 }, 1));
  assert.equal(await fs.readFile(store.file, "utf8"), before);
});
test("Concurrent saves with stale revision reject instead of overwriting", async (t) => {
  const { store } = await fixture(t);
  const j = await store.save(createJournal(), 0);
  const results = await Promise.allSettled([
    store.save(j, 1),
    store.save(j, 1),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    ["fulfilled", "rejected"],
  );
});
test("Failed rename leaves prior journal readable and does not advance in-memory revision", async (t) => {
  const { store } = await fixture(t);
  const j = await store.save(createJournal(), 0);
  const before = await fs.readFile(store.file, "utf8");
  store.atomic = async () => {
    throw new Error("disk failure");
  };
  await assert.rejects(store.save(j, 1));
  assert.equal(store.current.revision, 1);
  assert.equal(await fs.readFile(store.file, "utf8"), before);
});
test("Unrecoverable corruption blocks normal writes and permits explicit restore", async (t) => {
  const { store, dir } = await fixture(t);
  await fs.writeFile(store.file, "bad");
  const other = new JournalStore(dir, validateJournal);
  assert((await other.init()).blocked);
  await assert.rejects(other.save(createJournal(), 0));
  await other.save(createJournal(), 0, true);
  assert.equal(other.blocked, false);
  assert((await fs.readdir(dir)).some((f) => f.startsWith("damaged-")));
});
