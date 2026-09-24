import test from "node:test";
import assert from "node:assert/strict";
import { createUpdateClient } from "../src/update-client.mjs";

const history = [{ version: "1.9.9.17", notes: "Текущая версия" }];
const installed = { platform: "win32", portable: false };

test("update check reports current version and preserves release history", async () => {
  const client = createUpdateClient({
    check: async () => null,
    relaunch: async () => {},
    getPreferences: () => installed,
    version: "1.9.9.17",
    history,
  });

  assert.equal(client.updateState().state, "idle");
  const result = await client.checkUpdate();
  assert.equal(result.state, "current");
  assert.equal(result.version, "1.9.9.17");
  assert.equal(result.history, history);
});

test("updates download first, flush data, install only after confirmation, then relaunch", async () => {
  const sequence = [];
  const update = {
    version: "1.9.23",
    async download(onEvent) {
      sequence.push("download");
      onEvent({ event: "Started", data: { contentLength: 10 } });
      onEvent({ event: "Progress", data: { chunkLength: 5 } });
      assert.match(client.updateState().message, /50%/);
      onEvent({ event: "Progress", data: { chunkLength: 5 } });
    },
    async install() {
      sequence.push("install");
    },
  };
  const client = createUpdateClient({
    check: async () => update,
    relaunch: async () => sequence.push("relaunch"),
    getPreferences: () => installed,
    version: "1.9.22",
    history,
    flush: async () => sequence.push("flush"),
  });

  assert.equal((await client.checkUpdate()).state, "available");
  assert.deepEqual(sequence, []);
  assert.equal((await client.downloadUpdate()).state, "downloaded");
  assert.deepEqual(sequence, ["download"]);
  assert.equal((await client.installUpdate()).state, "installed");
  assert.deepEqual(sequence, ["download", "flush", "install", "relaunch"]);
});

test("portable and mobile builds never contact the update service", async () => {
  let calls = 0;
  const client = createUpdateClient({
    check: async () => {
      calls++;
      return null;
    },
    relaunch: async () => {},
    getPreferences: () => ({ platform: "win32", portable: true }),
    version: "1.9.9.17",
    history,
  });

  assert.equal(client.updateState().state, "unavailable");
  assert.equal((await client.checkUpdate()).state, "unavailable");
  assert.equal((await client.downloadUpdate()).state, "unavailable");
  assert.equal(calls, 0);
});

test("update service and installer errors remain visible to the user", async () => {
  let failDownload = false;
  let failCheck = false;
  const update = {
    version: "1.9.23",
    async download() {
      if (failDownload) throw new Error("signature mismatch");
    },
    async install() {
      throw new Error("installer failed");
    },
  };
  const client = createUpdateClient({
    check: async () => {
      if (failCheck) throw new Error("service unavailable");
      return update;
    },
    relaunch: async () => {},
    getPreferences: () => installed,
    version: "1.9.22",
    history,
  });

  assert.equal((await client.checkUpdate()).state, "available");
  failDownload = true;
  const downloadError = await client.downloadUpdate();
  assert.equal(downloadError.state, "error");
  assert.match(downloadError.message, /signature mismatch/);
  failDownload = false;
  assert.equal((await client.checkUpdate()).state, "available");
  assert.equal((await client.downloadUpdate()).state, "downloaded");
  const installError = await client.installUpdate();
  assert.equal(installError.state, "error");
  assert.match(installError.message, /installer failed/);
  failCheck = true;
  const serviceError = await client.checkUpdate();
  assert.equal(serviceError.state, "error");
  assert.match(serviceError.message, /service unavailable/);
});
