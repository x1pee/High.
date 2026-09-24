const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "desktop",
  Object.freeze({
    preferences: () => ipcRenderer.invoke("app:preferences"),
    configure: (data) => ipcRenderer.invoke("app:configure", data),
    updateState: () => ipcRenderer.invoke("app:update-state"),
    checkUpdate: () => ipcRenderer.invoke("app:check-update"),
    downloadUpdate: () => ipcRenderer.invoke("app:download-update"),
    installUpdate: () => ipcRenderer.invoke("app:install-update"),
    trash: () => ipcRenderer.invoke("graphs:trash"),
    restoreGraph: (id) => ipcRenderer.invoke("graphs:restore", id),
    load: () => ipcRenderer.invoke("journal:load"),
    save: (data, revision, replace) =>
      ipcRenderer.invoke("journal:save", data, revision, replace),
    export: () => ipcRenderer.invoke("journal:export"),
    import: () => ipcRenderer.invoke("journal:import"),
    backups: () => ipcRenderer.invoke("journal:backups"),
    graphs: () => ipcRenderer.invoke("graphs:list"),
    createGraph: (data) => ipcRenderer.invoke("graphs:create", data),
    openGraph: (id) => ipcRenderer.invoke("graphs:open", id),
    deleteGraph: (id) => ipcRenderer.invoke("graphs:delete", id),
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  }),
);
