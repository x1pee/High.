import test from "node:test";
import assert from "node:assert/strict";
import { createJournal, validateJournal } from "../src/domain.mjs";
import { createSyncCredentials } from "../src/sync-crypto.mjs";
import {
  createSyncClient,
  getSyncMarker,
  loadSyncCredentials,
  parseSyncCredentials,
  saveSyncCredentials,
  setSyncMarker,
  SyncRequestError,
} from "../src/sync-client.mjs";

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  };
}

function fakeServer() {
  let record = null;
  let revision = 0;
  return {
    fetch: async (url, options = {}) => {
      const path = new URL(url).pathname;
      if (path === "/v1/graphs")
        return Response.json({
          graphs: record
            ? [
                {
                  graphId: record.graphId,
                  revision,
                  updatedAt: record.updatedAt,
                },
              ]
            : [],
        });
      if (!path.startsWith("/v1/graphs/"))
        return Response.json({ error: "not_found" }, { status: 404 });
      const graphId = decodeURIComponent(path.slice("/v1/graphs/".length));
      if (options.method === "PUT") {
        const input = JSON.parse(options.body);
        if (input.baseRevision !== revision)
          return Response.json(
            { error: "revision_conflict", serverRevision: revision },
            { status: 409 },
          );
        revision += 1;
        record = {
          graphId,
          revision,
          cipherVersion: input.cipherVersion,
          nonce: input.nonce,
          ciphertext: input.ciphertext,
          updatedAt: "2026-09-24T00:00:00.000Z",
        };
        return Response.json({
          graphId,
          revision,
          updatedAt: record.updatedAt,
        });
      }
      if (!record || record.graphId !== graphId)
        return Response.json({ error: "not_found" }, { status: 404 });
      return Response.json(record);
    },
  };
}

test("sync credentials validate and persist without changing their secrets", () => {
  const storage = memoryStorage();
  const credentials = createSyncCredentials();
  assert.deepEqual(saveSyncCredentials(credentials, storage), credentials);
  assert.deepEqual(loadSyncCredentials(storage), credentials);
  assert.throws(
    () => parseSyncCredentials({ ...credentials, token: "bad" }),
    /Файл сопряжения/,
  );
  assert.throws(
    () => saveSyncCredentials({ ...credentials, encryptionKey: "00" }, storage),
    /Файл сопряжения/,
  );
});

test("sync client encrypts uploads and decrypts downloads on the device", async () => {
  const credentials = createSyncCredentials();
  const server = fakeServer();
  const client = createSyncClient({
    baseUrl: "https://sync.example",
    fetchImpl: server.fetch,
    validate: validateJournal,
  });
  const journal = createJournal("Private life", 100);
  const saved = await client.writeJournal(credentials, journal, 0);
  assert.equal(saved.revision, 1);
  assert.deepEqual(await client.listGraphs(credentials), [
    {
      graphId: journal.id,
      revision: 1,
      updatedAt: "2026-09-24T00:00:00.000Z",
    },
  ]);
  const restored = await client.readJournal(credentials, journal.id);
  assert.equal(restored.revision, 1);
  assert.deepEqual(restored.journal, journal);
});

test("stale sync writes surface a conflict and never replace the newer snapshot", async () => {
  const credentials = createSyncCredentials();
  const server = fakeServer();
  const client = createSyncClient({
    baseUrl: "https://sync.example",
    fetchImpl: server.fetch,
    validate: validateJournal,
  });
  const journal = createJournal("First", 100);
  await client.writeJournal(credentials, journal, 0);
  await assert.rejects(
    client.writeJournal(
      credentials,
      { ...journal, settings: { ...journal.settings, name: "Stale" } },
      0,
    ),
    (error) => error instanceof SyncRequestError && error.status === 409,
  );
  assert.equal(
    (await client.readJournal(credentials, journal.id)).journal.settings.name,
    "First",
  );
});

test("sync markers validate local and server revisions", () => {
  const storage = memoryStorage();
  setSyncMarker(
    "account-1",
    "graph-1",
    { serverRevision: 2, localRevision: 7 },
    storage,
  );
  assert.deepEqual(getSyncMarker("account-1", "graph-1", storage), {
    serverRevision: 2,
    localRevision: 7,
  });
  storage.setItem("high.sync.marker.v1:account-1:graph-1", "{broken");
  assert.equal(getSyncMarker("account-1", "graph-1", storage), null);
});
