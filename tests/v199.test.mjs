import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { createJournal, validateJournal, upsertEvent } from "../src/domain.mjs";
const require = createRequire(import.meta.url),
  { GraphLibrary } = require("../desktop/library.cjs"),
  { application } = require("../desktop/application.cjs");
test("archive restores full journal and expires after 30 days without resurrection", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vyshe-archive-"));
  let lib = new GraphLibrary(dir, validateJournal);
  await lib.init();
  let j = createJournal("Archive", 100);
  j = upsertEvent(j, {
    date: "2026-09-20",
    time: "10:00",
    text: "remember",
    delta: 7,
  });
  await lib.save(j, 0, true);
  j = lib.current;
  await lib.remove(j.id);
  assert.equal((await lib.trash()).length, 1);
  await lib.restore(j.id);
  assert.equal(lib.current.events[0].text, "remember");
  assert.equal((await lib.trash()).length, 0);
  await lib.remove(j.id);
  const file = path.join(lib.deleted, path.basename(lib.filename(j.id)));
  const old = new Date(Date.now() - 31 * 86400000);
  await fs.utimes(file, old, old);
  assert.equal((await lib.trash()).length, 0);
  await assert.rejects(lib.restore(j.id));
  lib = new GraphLibrary(dir, validateJournal);
  await lib.init();
  assert.equal(lib.current, null);
  assert.equal((await lib.list()).length, 0);
  assert.equal(JSON.parse(await fs.readFile(file)).expired, true);
});
test("update lifecycle waits for explicit download/install and flushes saves", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vyshe-updates-")),
    handlers = new Map(),
    app = new EventEmitter();
  let flushed = false,
    installed = false,
    downloads = 0;
  Object.assign(app, {
    getPath: () => dir,
    getVersion: () => "1.9.9",
    isPackaged: true,
  });
  const updater = new EventEmitter();
  Object.assign(updater, {
    setFeedURL: () => {},
    checkForUpdates: async () => {
      updater.emit("checking-for-update");
      updater.emit("update-available", { version: "2.0.0" });
    },
    downloadUpdate: async () => {
      downloads++;
      updater.emit("download-progress", { percent: 50 });
      updater.emit("update-downloaded");
    },
    quitAndInstall: () => {
      assert(flushed);
      installed = true;
    },
  });
  await application({
    app,
    ipcMain: { handle: (k, fn) => handlers.set(k, fn) },
    shell: {},
    Tray: class {},
    Menu: {},
    trusted: () => {},
    window: () => null,
    flush: async () => {
      flushed = true;
    },
    releaseChannel: { url: "https://example.invalid/releases/", history: [] },
    updaterFactory: () => updater,
  });
  const call = (k) => handlers.get("app:" + k)({});
  await call("check-update");
  assert.equal((await call("update-state")).state, "available");
  assert.equal(downloads, 0);
  await call("install-update");
  assert.equal(installed, false);
  await call("download-update");
  assert.equal(downloads, 1);
  assert.equal((await call("update-state")).state, "downloaded");
  await call("install-update");
  assert(installed);
});

test("tray preference only hides an explicit autostart launch", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vyshe-tray-"));
  const handlers = new Map();
  const app = new EventEmitter();
  Object.assign(app, { getPath: () => dir, getVersion: () => "1.9.12", isPackaged: false });
  let trays = 0,
    destroyedTrays = 0;
  class Tray {
    constructor() { trays++; }
    setToolTip() {}
    setContextMenu() {}
    destroy() { destroyedTrays++; }
    on() {}
  }
  const runtime = await application({
    app, ipcMain: { handle: (k, fn) => handlers.set(k, fn) }, shell: {}, Tray,
    Menu: { buildFromTemplate: () => ({}) }, trusted: () => {},
    window: () => null, flush: async () => {},
    releaseChannel: { url: null, history: [] },
    commandLineArgs: ["VYSHE"],
  });
  assert(runtime.showOnStart());
  await handlers.get("app:configure")({}, { autoStart: true, tray: true, autoUpdates: false, shortcut: false });
  assert.equal(trays, 0, "manual launch should not create a tray-only session");
  assert.equal(runtime.showOnStart(), true, "opening the app normally always shows its window");
  const backgroundRuntime = await application({
    app,
    ipcMain: { handle: (k, fn) => handlers.set(k, fn) },
    shell: {},
    Tray,
    Menu: { buildFromTemplate: () => ({}) },
    trusted: () => {},
    window: () => null,
    flush: async () => {},
    releaseChannel: { url: null, history: [] },
    commandLineArgs: ["VYSHE", "--background"],
  });
  assert.equal(trays, 1, "the background autostart creates the tray icon");
  assert.equal(backgroundRuntime.showOnStart(), false);
  await handlers.get("app:configure")({}, { autoStart: true, tray: false, autoUpdates: false, shortcut: false });
  assert.equal(destroyedTrays, 1);
  assert.equal(backgroundRuntime.showOnStart(), true, "background mode is ignored when tray launch is disabled");
  await handlers.get("app:configure")({}, { autoStart: false, tray: true, autoUpdates: false, shortcut: false });
  const saved = await handlers.get("app:preferences")({});
  assert.equal(saved.autoStart, false);
  assert.equal(saved.tray, false, "tray launch is disabled together with Windows autostart");
  const window = new EventEmitter();
  runtime.bindWindow(window);
  assert.equal(window.listenerCount("close"), 0);
});

test("desktop shortcut creation does not create duplicates", async (t) => {
  if (process.platform === "darwin") return t.skip("desktop shortcuts are not used on macOS");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vyshe-shortcut-"));
  const desktop = path.join(dir, "Desktop");
  await fs.mkdir(desktop);
  const handlers = new Map();
  const app = new EventEmitter();
  Object.assign(app, {
    getPath: (name) => name === "desktop" ? desktop : dir,
    getVersion: () => "1.9.12",
    isPackaged: true,
    setLoginItemSettings() {},
  });
  let creates = 0,
    shortcutTarget = "";
  const actions = [];
  const shell = {
    readShortcutLink() { return { target: shortcutTarget }; },
    writeShortcutLink(target, action, options) {
      creates++;
      actions.push(action);
      shortcutTarget = options.target;
      fsSync.writeFileSync(target, "shortcut");
      return true;
    },
  };
  await application({
    app,
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    shell,
    Tray: class { setToolTip() {} setContextMenu() {} on() {} },
    Menu: { buildFromTemplate: () => ({}) },
    trusted: () => {},
    window: () => null,
    flush: async () => {},
    releaseChannel: { url: null, history: [] },
    commandLineArgs: ["VYSHE"],
  });
  try {
    const configure = handlers.get("app:configure");
    const settings = { autoStart: false, tray: false, autoUpdates: false, shortcut: true };
    await configure({}, settings);
    await configure({}, settings);
    assert.equal(creates, process.platform === "win32" ? 1 : 0);
    let preferences = await handlers.get("app:preferences")({});
    assert.equal(preferences.desktopShortcutExists, true);
    assert.equal(preferences.desktopShortcutMatches, true);
    if (process.platform === "win32") {
      shortcutTarget = path.join(dir, "old-user-install", "Vyshe.exe");
      preferences = await handlers.get("app:preferences")({});
      assert.equal(preferences.desktopShortcutExists, true);
      assert.equal(preferences.desktopShortcutMatches, false);
      await configure({}, settings);
      assert.deepEqual(actions, ["create", "update"]);
      assert.equal((await handlers.get("app:preferences")({})).desktopShortcutMatches, true);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("installed app opens visibly after setup even when tray autostart is enabled", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vyshe-upgrade-launch-"));
  const file = path.join(dir, "preferences.json");
  await fs.writeFile(
    file,
    JSON.stringify({ initialized: true, autoStart: true, tray: true, autoUpdates: false }),
  );
  const launch = async (commandLineArgs) => {
    const app = new EventEmitter();
    Object.assign(app, { getPath: () => dir, getVersion: () => "1.9.12", isPackaged: true });
    return application({
      app,
      ipcMain: { handle: () => {} },
      shell: {},
      Tray: class { setToolTip() {} setContextMenu() {} on() {} },
      Menu: { buildFromTemplate: () => ({}) },
      trusted: () => {},
      window: () => null,
      flush: async () => {},
      releaseChannel: { url: null, history: [] },
      commandLineArgs,
    });
  };
  try {
    const installedLaunch = await launch(["VYSHE"]);
    assert.equal(installedLaunch.showOnStart(), true);
    const windowsLogin = await launch(["VYSHE", "--background"]);
    assert.equal(windowsLogin.showOnStart(), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
