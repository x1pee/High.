const {
  app,
  Tray,
  Menu,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
  session,
  shell,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { GraphLibrary } = require("./library.cjs");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "vyshe",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
if (process.env.VYSHE_DATA_DIR)
  app.setPath("userData", process.env.VYSHE_DATA_DIR);
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let win, store, loaded, validateJournal;
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});
function trusted(event) {
  if (
    event.sender !== win?.webContents ||
    !event.senderFrame?.url.startsWith("vyshe://app/")
  )
    throw new Error("Недоступный запрос");
}
if (locked)
  app.whenReady().then(async () => {
    ({ validateJournal } = await import("../src/domain.mjs"));
    store = new GraphLibrary(app.getPath("userData"), validateJournal);
    loaded = await store.init();
    const desktopApp = await require("./application.cjs").application({
      app,
      ipcMain,
      shell,
      Tray,
      Menu,
      trusted,
      window: () => win,
      flush: () => store.queue,
    });
    ipcMain.handle("graphs:trash", (e) => {
      trusted(e);
      return store.trash();
    });
    ipcMain.handle("graphs:restore", (e, id) => {
      trusted(e);
      return store.restore(id);
    });
    protocol.handle("vyshe", (request) => {
      const url = new URL(request.url);
      const root = path.resolve(__dirname, "..");
      const file = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (
        url.hostname !== "app" ||
        !file.startsWith(root + path.sep) ||
        ![".html", ".css", ".mjs", ".svg", ".png", ".ico", ".woff2"].includes(
          path.extname(file),
        )
      )
        return new Response("Forbidden", { status: 403 });
      return net.fetch(pathToFileURL(file).href);
    });
    session.defaultSession.setPermissionRequestHandler((_w, _p, cb) =>
      cb(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    ipcMain.handle("journal:load", (e) => {
      trusted(e);
      return { ...loaded, journal: store.current };
    });
    ipcMain.handle("journal:save", (e, data, revision, replace) => {
      trusted(e);
      return store.save(data, revision, replace === true);
    });
    ipcMain.handle("graphs:list", (e) => {
      trusted(e);
      return store.list();
    });
    ipcMain.handle("graphs:create", (e, data) => {
      trusted(e);
      return store.create(data);
    });
    ipcMain.handle("graphs:open", (e, id) => {
      trusted(e);
      return store.open(id);
    });
    ipcMain.handle("graphs:delete", (e, id) => {
      trusted(e);
      return store.remove(id);
    });
    ipcMain.handle("journal:export", async (e) => {
      trusted(e);
      await store.queue;
      if (!store.current) throw new Error("Сначала создайте дневник");
      const { filePath, canceled } = await dialog.showSaveDialog(win, {
        title: "Экспорт дневника",
        defaultPath: `Vyshe-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "Дневник Выше", extensions: ["json"] }],
      });
      if (canceled) return false;
      const reserved = path.resolve(filePath).toLowerCase();
      if (
        reserved.startsWith(
          path.resolve(store.directory).toLowerCase() + path.sep,
        )
      )
        throw new Error("Выберите папку вне служебного хранилища приложения");
      await fs.writeFile(
        filePath,
        JSON.stringify(store.current, null, 2),
        "utf8",
      );
      return true;
    });
    ipcMain.handle("journal:import", async (e) => {
      trusted(e);
      const result = await dialog.showOpenDialog(win, {
        title: "Открыть дневник или резервную копию",
        properties: ["openFile"],
        filters: [{ name: "Дневник Выше", extensions: ["json"] }],
      });
      if (result.canceled) return null;
      const p = result.filePaths[0];
      if ((await fs.stat(p)).size > 32 * 1024 * 1024)
        throw new Error("Файл больше 32 МБ");
      return validateJournal(JSON.parse(await fs.readFile(p, "utf8")));
    });
    ipcMain.handle("journal:backups", (e) => {
      trusted(e);
      return shell.openPath(store.backups);
    });
    for (const action of ["minimize", "maximize", "close"])
      ipcMain.on("window:" + action, (e) => {
        trusted(e);
        if (action === "maximize")
          win.isMaximized() ? win.unmaximize() : win.maximize();
        else win[action]();
      });
    win = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 860,
      minHeight: 650,
      show: false,
      frame: false,
      backgroundColor: "#111514",
      title: "Выше · График жизни",
      icon: path.join(__dirname, process.platform === "win32" ? "../assets/icon.ico" : "../assets/icon.png"),
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    desktopApp.bindWindow(win);
    win.once("ready-to-show", () => {
      if (desktopApp.showOnStart()) win.show();
    });
    await win.loadURL("vyshe://app/src/index.html");
  });
app.on("window-all-closed", () => app.quit());
