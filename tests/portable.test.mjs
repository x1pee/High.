import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
const { application } = createRequire(import.meta.url)("../desktop/application.cjs");

test("portable login and shortcut use the outer EXE, survive relocation and never run NSIS updater", async (t) => {
  if (process.platform !== "win32") return t.skip("Windows portable package");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vyshe-portable-"));
  const outer = path.join(dir, "Мои программы", "Vyshe Portable.exe");
  const logins = [], shortcuts = [];
  let shortcutTarget = "", updaterCalls = 0;
  const app = new EventEmitter();
  Object.assign(app, {
    isPackaged: true,
    getPath: () => dir,
    setLoginItemSettings: (value) => logins.push(value),
  });
  const start = async (executable, args = []) => {
    const handlers = new Map();
    const runtime = await application({
      app, ipcMain: { handle: (k, fn) => handlers.set(k, fn) },
      shell: {
        readShortcutLink: () => ({ target: shortcutTarget }),
        writeShortcutLink(file, action, options) {
          shortcuts.push({ file, action, ...options });
          shortcutTarget = options.target;
          fsSync.writeFileSync(file, "test shortcut");
          return true;
        },
      },
      Tray: class { setToolTip() {} setContextMenu() {} on() {} destroy() {} },
      Menu: { buildFromTemplate: () => ({}) },
      trusted() {}, window: () => null, flush: async () => {},
      environment: { PORTABLE_EXECUTABLE_FILE: executable }, commandLineArgs: args,
      releaseChannel: { url: "https://example.invalid/nsis-releases", history: [] },
      updaterFactory: () => { updaterCalls++; throw Error("must not create NSIS updater"); },
    });
    return { runtime, call: (name, data) => handlers.get("app:" + name)({}, data) };
  };
  try {
    const first = await start(outer);
    await first.call("configure", { autoStart: true, tray: true, autoUpdates: true, shortcut: true });
    assert.deepEqual(logins.at(-1), { openAtLogin: true, path: outer, args: ["--background"] });
    assert.equal(shortcuts[0].target, outer);
    assert.equal(shortcuts[0].icon, outer);
    assert.equal(shortcuts[0].cwd, path.dirname(outer));
    assert.equal(first.runtime.showOnStart(), true);
    const prefs = await first.call("preferences");
    assert.equal(prefs.portable, true);
    assert.equal(prefs.executable, outer);
    assert.equal(prefs.desktopShortcutMatches, true);
    assert.equal(updaterCalls, 0);
    assert.equal((await first.call("check-update")).state, "unconfigured");
    const moved = path.join(dir, "new folder", "Vyshe.exe");
    const next = await start(moved, ["--background"]);
    assert.equal(logins.at(-1).path, moved, "enabled login entry follows a moved portable file");
    assert.equal(next.runtime.showOnStart(), false);
    await next.call("configure", { autoStart: false, tray: true, autoUpdates: false, shortcut: true });
    assert.deepEqual(logins.at(-1), { openAtLogin: false, path: moved, args: [] });
    assert.equal(shortcuts.at(-1).action, "update");
    assert.equal(shortcuts.at(-1).file, shortcuts[0].file);
    assert.equal(shortcuts.at(-1).target, moved);
    assert.equal((await next.call("preferences")).tray, false);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
