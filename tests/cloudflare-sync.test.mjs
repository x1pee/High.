import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import worker from "../cloudflare/worker.mjs";
import { createJournal, validateJournal, upsertEvent } from "../src/domain.mjs";
import { createSyncClient, syncAction, assertSyncTarget } from "../src/sync-client.mjs";
import libraryModule from '../desktop/library.cjs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createSyncCredentials,
  decryptSnapshot,
  encryptSnapshot,
} from "../src/sync-crypto.mjs";

class D1SQLite {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec("PRAGMA foreign_keys = ON");
  }
  prepare(sql) {
    const db = this.db;
    return {
      bind: (...args) => ({
        first: async () => db.prepare(sql).get(...args),
        all: async () => ({ results: db.prepare(sql).all(...args) }),
        run: async () => {
          const result = db.prepare(sql).run(...args);
          return { meta: { changes: Number(result.changes) } };
        },
      }),
    };
  }
}

async function setup() {
  const db = new D1SQLite();
  db.db.exec(
    await readFile(
      new URL("../cloudflare/migrations/0001_create_sync.sql", import.meta.url),
      "utf8",
    ),
  );
  const credentials = createSyncCredentials();
  const tokenHash = createHash("sha256")
    .update(credentials.token)
    .digest("hex");
  db.db
    .prepare(
      "INSERT INTO sync_accounts (account_id, token_hash, created_at) VALUES (?, ?, ?)",
    )
    .run(credentials.accountId, tokenHash, new Date().toISOString());
  const env = {
    DB: db,
    ALLOWED_ORIGINS: "tauri://localhost,http://localhost:1420",
  };
  const request = (
    path,
    {
      method = "GET",
      body,
      token = credentials.token,
      origin = "tauri://localhost",
    } = {},
  ) =>
    worker.fetch(
      new Request(`https://sync.example${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(origin ? { Origin: origin } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      env,
    );
  return { db, credentials, request, env };
}

test("encrypted snapshot round-trips and rejects wrong keys or altered metadata", async () => {
  const credentials = createSyncCredentials();
  const journal = createJournal("Private journal", 100);
  const envelope = await encryptSnapshot(journal, credentials);
  assert.notEqual(envelope.ciphertext.includes("Private journal"), true);
  assert.deepEqual(
    await decryptSnapshot(envelope, credentials, journal.id, validateJournal),
    journal,
  );
  await assert.rejects(
    decryptSnapshot(
      envelope,
      { ...credentials, encryptionKey: "00".repeat(32) },
      journal.id,
    ),
  );
  await assert.rejects(decryptSnapshot(envelope, credentials, "another-graph"));
});

test("API requires a bearer token and only exposes the caller's account data", async () => {
  const { credentials, request } = await setup();
  assert.equal((await request("/v1/graphs", { token: "" })).status, 401);
  const response = await request("/v1/graphs");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { graphs: [] });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(credentials.token.length, 64);
});

test("snapshot writes use compare-and-swap revisions and reject stale updates", async () => {
  const { credentials, request } = await setup();
  const journal = createJournal("Encrypted only", 100);
  const encrypted = await encryptSnapshot(journal, credentials);
  const body = { baseRevision: 0, ...encrypted };
  let response = await request(`/v1/graphs/${journal.id}`, {
    method: "PUT",
    body,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 1);
  const changedJournal = {
    ...journal,
    settings: { ...journal.settings, name: "Updated private journal" },
  };
  const changed = await encryptSnapshot(changedJournal, credentials);
  response = await request(`/v1/graphs/${journal.id}`, {
    method: "PUT",
    body: { baseRevision: 1, ...changed },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).revision, 2);
  response = await request(`/v1/graphs/${journal.id}`, { method: "PUT", body });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "revision_conflict",
    serverRevision: 2,
  });
  response = await request(`/v1/graphs/${journal.id}`);
  const stored = await response.json();
  assert.equal(stored.revision, 2);
  assert.equal(stored.ciphertext, changed.ciphertext);
  assert.equal("settings" in stored, false);
});

test("a second account cannot discover or fetch the first account's graph", async () => {
  const { db, credentials, request } = await setup();
  const privateCredentials = createSyncCredentials();
  const tokenHash = createHash("sha256")
    .update(privateCredentials.token)
    .digest("hex");
  db.db
    .prepare(
      "INSERT INTO sync_accounts (account_id, token_hash, created_at) VALUES (?, ?, ?)",
    )
    .run(privateCredentials.accountId, tokenHash, new Date().toISOString());
  const journal = createJournal("Owner only", 100);
  const ciphertext = await encryptSnapshot(journal, credentials);
  const write = await request(`/v1/graphs/${journal.id}`, {
    method: "PUT",
    body: { baseRevision: 0, ...ciphertext },
  });
  assert.equal(write.status, 200);
  assert.deepEqual(
    await (
      await request("/v1/graphs", { token: privateCredentials.token })
    ).json(),
    { graphs: [] },
  );
  assert.equal(
    (
      await request(`/v1/graphs/${journal.id}`, {
        token: privateCredentials.token,
      })
    ).status,
    404,
  );
});

test("API rejects malformed ciphertext and unapproved browser origins", async () => {
  const { request } = await setup();
  const malformed = await request("/v1/graphs/g1", {
    method: "PUT",
    body: {
      baseRevision: 0,
      cipherVersion: 1,
      nonce: "bad",
      ciphertext: "bad",
    },
  });
  assert.equal(malformed.status, 400);
  const denied = await request("/v1/graphs", {
    origin: "https://evil.example",
  });
  assert.equal(denied.status, 403);
  const oversized = await request('/v1/graphs/g1', {
    method: 'PUT', body: { ciphertext: 'A'.repeat(1_800_001) },
  });
  assert.equal(oversized.status, 413, 'body limit must hold without Content-Length');
});

test("two isolated journals exchange encrypted data, restart, and preserve both sides of a conflict", async t => {
  const { db, credentials, env } = await setup();
  t.after(() => db.db.close());
  const root = await mkdtemp(path.join(os.tmpdir(), 'high-sync-audit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { GraphLibrary } = libraryModule;
  const a = new GraphLibrary(path.join(root, 'device-a'), validateJournal);
  let b = new GraphLibrary(path.join(root, 'device-b'), validateJournal);
  await a.init(); await b.init();
  await a.create(createJournal('Общий дневник', 100));
  const oldB = await b.create(createJournal('Отдельный локальный', 100));
  const clients = [0, 1].map(() => createSyncClient({
    baseUrl: 'https://sync.example', validate: validateJournal,
    fetchImpl: (url, options) => worker.fetch(new Request(url, options), env),
  }));
  const first = await a.save(upsertEvent(a.current, { date: '2026-09-27', time: '10:00', text: 'Запись A', delta: 2 }), a.current.revision);
  await clients[0].writeJournal(credentials, first, 0);
  const cloud = await clients[1].readJournal(credentials, first.id);
  const localB = await b.save(cloud.journal, b.current.revision, true);
  assert.ok((await b.list()).some(graph => graph.id === oldB.id), 'pairing preserves the previous graph');
  const marker = { localRevision: localB.revision, serverRevision: cloud.revision };
  b = new GraphLibrary(path.join(root, 'device-b'), validateJournal);
  await b.init();
  assert.equal(b.current.events[0].text, 'Запись A');
  assert.equal(syncAction(b.current, cloud, marker), 'unchanged');
  const before = structuredClone(b.current);
  const offlineB = await b.save(upsertEvent(b.current, { date: '2026-09-27', time: '11:00', text: 'Запись B без сети', delta: 3 }), b.current.revision);
  const newA = await a.save(upsertEvent(a.current, { date: '2026-09-27', time: '11:01', text: 'Новая запись A', delta: 4 }), a.current.revision);
  await clients[0].writeJournal(credentials, newA, 1);
  await assert.rejects(clients[1].writeJournal(credentials, offlineB, 1), error => error.status === 409);
  const newer = await clients[1].readJournal(credentials, first.id);
  assert.equal(syncAction(b.current, newer, marker), 'conflict');
  assert.throws(() => assertSyncTarget(b.current, before), /изменился/);
  assert.ok(b.current.events.some(event => event.text === 'Запись B без сети'));
  assert.ok(newer.journal.events.some(event => event.text === 'Новая запись A'));
  const row = db.db.prepare('SELECT ciphertext FROM sync_journals').get();
  assert.equal(row.ciphertext.includes('Запись'), false);
});
