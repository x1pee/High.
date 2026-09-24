const fs = require("node:fs/promises");
const path = require("node:path");
const channel = require("./release-channel.json");

async function application({
  app,
  ipcMain,
  shell,
  Tray,
  Menu,
  trusted,
  window: getWindow,
  flush,
  releaseChannel = channel,
  commandLineArgs = process.argv,
  environment = process.env,
  updaterFactory = () => require("electron-updater").autoUpdater,
}) {
  const file = path.join(app.getPath("userData"), "preferences.json");
  const portable = process.platform === "win32" && !!environment.PORTABLE_EXECUTABLE_FILE;
  const executable = portable
    ? environment.PORTABLE_EXECUTABLE_FILE
    : process.platform === "linux"
      ? environment.APPIMAGE || process.execPath
      : process.execPath;
  const isolated = !!environment.VYSHE_DATA_DIR;
  const configureLoginItem = (autoStart, trayOnStart) => {
    if (!isolated && app.isPackaged && ["win32", "darwin"].includes(process.platform)) {
      app.setLoginItemSettings({
        openAtLogin: autoStart,
        path: executable,
        args: autoStart && trayOnStart ? ["--background"] : [],
      });
    }
  };
  const desktopShortcutName =
    process.platform === "win32"
      ? "VYSHE.lnk"
      : process.platform === "linux"
        ? "VYSHE.desktop"
        : null;
  const desktopShortcutPath = desktopShortcutName
    ? path.join(app.getPath("desktop"), desktopShortcutName)
    : null;
  const desktopShortcutState = async () => {
    if (!desktopShortcutPath) return { exists: false, matches: false };
    try {
      await fs.access(desktopShortcutPath);
    } catch {
      return { exists: false, matches: false };
    }
    try {
      if (process.platform === "win32") {
        const target = shell.readShortcutLink(desktopShortcutPath).target;
        return {
          exists: true,
          matches:
            path.resolve(target).toLowerCase() ===
            path.resolve(executable).toLowerCase(),
        };
      }
      const contents = await fs.readFile(desktopShortcutPath, "utf8");
      const launchPath = executable;
      return {
        exists: true,
        matches: contents.includes(`Exec="${launchPath.replace(/"/g, '\\"')}"`),
      };
    } catch {
      return { exists: true, matches: false };
    }
  };
  let preferences = {
    initialized: false,
    autoStart: false,
    tray: false,
    autoUpdates: true,
  };
  try {
    preferences = {
      ...preferences,
      ...JSON.parse(await fs.readFile(file, "utf8")),
    };
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  let tray,
    quitting = false,
    updater;
  const isBackgroundLaunch = commandLineArgs.includes("--background");
  const shouldStartInTray = () =>
    isBackgroundLaunch && preferences.autoStart && preferences.tray;
  // A moved portable EXE repairs its enabled login entry on the next manual launch.
  if (portable && preferences.autoStart) configureLoginItem(true, preferences.tray);
  let status = {
    state: "unconfigured",
    version: "1.9.9.4",
    message: "Канал обновлений ещё не опубликован.",
    history: releaseChannel.history,
  };
  const show = () => {
    const w = getWindow();
    w.show();
    if (w.isMinimized()) w.restore();
    w.focus();
  };
  const quit = async () => {
    await flush();
    quitting = true;
    app.quit();
  };
  function setupTray() {
    if (shouldStartInTray() && !tray) {
      tray = new Tray(path.join(__dirname, process.platform === "win32" ? "../assets/icon.ico" : "../assets/icon.png"));
      tray.setToolTip("VYSHE");
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: "Открыть VYSHE", click: show },
          { type: "separator" },
          { label: "Выйти", click: quit },
        ]),
      );
      tray.on("double-click", show);
    } else if (!shouldStartInTray() && tray) {
      tray.destroy();
      tray = null;
    }
  }
  const setStatus = (state, message, extra = {}) => {
    status = { ...status, ...extra, state, message };
  };
  if (
    !portable && releaseChannel.url &&
    /^https:\/\//.test(releaseChannel.url) &&
    app.isPackaged
  ) {
    updater = updaterFactory();
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.setFeedURL({ provider: "generic", url: releaseChannel.url });
    setStatus("idle", "Можно проверить обновления.");
    updater.on("checking-for-update", () =>
      setStatus("checking", "Проверяю обновления…"),
    );
    updater.on("update-not-available", () =>
      setStatus("current", "Установлена последняя версия."),
    );
    updater.on("update-available", (info) =>
      setStatus("available", `Доступна версия ${info.version}`, {
        nextVersion: info.version,
      }),
    );
    updater.on("download-progress", (p) =>
      setStatus("downloading", `Загрузка: ${Math.round(p.percent)}%`, {
        percent: p.percent,
      }),
    );
    updater.on("update-downloaded", () =>
      setStatus(
        "downloaded",
        "Обновление готово. Можно перезапустить приложение.",
      ),
    );
    updater.on("error", () =>
      setStatus(
        "error",
        "Не удалось получить обновление. Проверь подключение и попробуй ещё раз.",
      ),
    );
  }
  if (portable) {
    setStatus("unconfigured", "Версия без установки: обновление заменой EXE. Дневник сохраняется. Автоматический канал для этой версии пока не опубликован.");
  }
  let checking = false;
  const check = async () => {
    if (
      !updater ||
      checking ||
      ["downloading", "downloaded"].includes(status.state)
    )
      return status;
    checking = true;
    try {
      await updater.checkForUpdates();
    } catch {
      /* error event sets readable status */
    } finally {
      checking = false;
    }
    return status;
  };
  ipcMain.handle("app:preferences", (e) => {
    trusted(e);
    return desktopShortcutState().then((desktopShortcut) => ({
      ...preferences,
      platform: process.platform,
      dataPath: app.getPath("userData"),
      executable,
      portable,
      desktopShortcutExists: desktopShortcut.exists,
      desktopShortcutMatches: desktopShortcut.matches,
    }));
  });
  ipcMain.handle("app:configure", async (e, input) => {
    trusted(e);
    if (
      !input ||
      ["autoStart", "tray", "autoUpdates"].some(
        (k) => typeof input[k] !== "boolean",
      ) ||
      (input.shortcut !== undefined && typeof input.shortcut !== "boolean")
    )
      throw new Error("Некорректные настройки");
    const trayOnStart = input.autoStart && input.tray;
    if (!isolated && app.isPackaged) {
      const launchPath = executable;
      configureLoginItem(input.autoStart, trayOnStart);
      if (process.platform === "linux") {
        const auto = path.join(app.getPath("home"), ".config", "autostart", "vyshe.desktop");
        if (input.autoStart) {
          await fs.mkdir(path.dirname(auto), { recursive: true });
          await fs.writeFile(auto, `[Desktop Entry]\nType=Application\nName=VYSHE\nExec="${launchPath.replace(/"/g, '\\"')}"${trayOnStart ? ' --background' : ''}\nTerminal=false\n`, "utf8");
        } else await fs.rm(auto, { force: true });
        const shortcut = await desktopShortcutState();
        if (input.shortcut === true && !shortcut.matches) {
          const shortcut = desktopShortcutPath;
          await fs.writeFile(shortcut, `[Desktop Entry]\nType=Application\nName=VYSHE\nExec="${launchPath.replace(/"/g, '\\"')}"\nTerminal=false\n`, { mode: 0o755 });
        }
      }
      if (
        process.platform === "win32" &&
        input.shortcut === true &&
        !(await desktopShortcutState()).matches &&
        !shell.writeShortcutLink(
          desktopShortcutPath,
          (await desktopShortcutState()).exists ? "update" : "create",
          {
            target: executable,
            cwd: path.dirname(executable),
            description: "VYSHE — график жизни",
            icon: executable,
            iconIndex: 0,
          },
        )
      )
        throw new Error("Не удалось создать ярлык");
    }
    const next = {
      initialized: true,
      autoStart: input.autoStart,
      tray: trayOnStart,
      autoUpdates: input.autoUpdates,
    };
    await fs.writeFile(file + ".tmp", JSON.stringify(next, null, 2));
    await fs.rename(file + ".tmp", file);
    preferences = next;
    setupTray();
    if (preferences.autoUpdates) void check();
    return preferences;
  });
  ipcMain.handle("app:update-state", (e) => {
    trusted(e);
    return status;
  });
  ipcMain.handle("app:check-update", async (e) => {
    trusted(e);
    return check();
  });
  ipcMain.handle("app:download-update", async (e) => {
    trusted(e);
    if (updater && status.state === "available") {
      setStatus("downloading", "Начинаю загрузку…");
      try {
        await updater.downloadUpdate();
      } catch {}
    }
    return status;
  });
  ipcMain.handle("app:install-update", async (e) => {
    trusted(e);
    if (updater && status.state === "downloaded") {
      await flush();
      quitting = true;
      updater.quitAndInstall(false, true);
    }
  });
  app.on("before-quit", () => {
    quitting = true;
  });
  setupTray();
  const timer = setInterval(
    () => {
      if (preferences.autoUpdates) void check();
    },
    6 * 60 * 60 * 1000,
  );
  timer.unref();
  if (preferences.autoUpdates) setTimeout(() => void check(), 8000).unref();
  return {
    bindWindow(w) {
      // Closing exits; only an autostart launch with --background stays in the tray.
    },
    showOnStart: () => !shouldStartInTray(),
  };
}
module.exports = { application };
