// Browser/Capacitor counterpart of the Electron preload. Data stays on this
// device until the owner explicitly exports it; cross-device sync is future work.
import { RELEASE_HISTORY } from "./release-history.mjs";
import { validateJournal } from "./domain.mjs";
import { assertPriceChange } from "./price-policy.mjs";

// Keep this IndexedDB name so a product rename never strands a local journal.
const DB = "vyshe-local-v1";
const KEY = "library";
const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB, 1);
  request.onupgradeneeded = () => request.result.createObjectStore("state");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const db = await openDb();
function read() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readonly");
    const request = tx.objectStore("state").get(KEY);
    request.onsuccess = () => resolve(request.result ?? { currentId: null, graphs: {}, deleted: {}, backups: [] });
    request.onerror = () => reject(request.error);
  });
}
function write(value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    tx.objectStore("state").put(value, KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
let queue = Promise.resolve();
function mutate(work) {
  const next = queue.then(async () => {
    const state = await read();
    const result = await work(state);
    await write(state);
    return result;
  });
  queue = next.catch(() => {});
  return next;
}
const current = (state) => state.graphs[state.currentId] ?? null;
const saveCopy = (state, journal) => {
  if (!journal) return;
  state.backups.push(journal);
  state.backups = state.backups.slice(-30);
};
const revision = (journal, previous) => ({
  ...journal,
  revision: (previous?.revision ?? 0) + 1,
  updatedAt: new Date().toISOString(),
});
function purge(state) {
  const now = Date.now();
  for (const [id, item] of Object.entries(state.deleted)) {
    if (now - Date.parse(item.deletedAt) > 30 * 86400000)
      state.deleted[id] = { deletedAt: item.deletedAt, expired: true };
  }
}
function chooseImport() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        if (file.size > 32 * 1024 * 1024) throw new Error("Файл слишком большой");
        resolve(validateJournal(JSON.parse(await file.text())));
      } catch (error) { reject(error); }
    };
    input.click();
  });
}

document.documentElement.classList.add("mobile-runtime");
window.desktop = Object.freeze({
  load: async () => ({ journal: current(await read()), blocked: false }),
  save: (data, expected, replace = false) => mutate((state) => {
    purge(state);
    const next = validateJournal(data);
    const previous = current(state);
    if (expected !== (previous?.revision ?? 0))
      throw new Error("Данные уже изменились. Перезапусти приложение.");
    if (state.deleted[next.id] && !replace)
      throw new Error("Этот график удалён");
    if (!replace && previous && next.id !== previous.id)
      throw new Error("График уже переключён");
    if (!replace) assertPriceChange(previous, next);
    saveCopy(state, previous);
    const saved = revision(next, previous);
    state.graphs[saved.id] = saved;
    state.currentId = saved.id;
    if (replace) delete state.deleted[saved.id];
    return saved;
  }),
  graphs: async () => {
    const state = await read();
    return Object.values(state.graphs).filter(j => !state.deleted[j.id]).map(j => ({
      id: j.id, name: j.settings.name, initial: j.settings.initial,
      events: j.events.filter(e => !e.deletedAt).length, updatedAt: j.updatedAt,
      active: j.id === state.currentId,
    }));
  },
  createGraph: data => mutate(state => {
    const next = validateJournal(data);
    assertPriceChange(null, next);
    if (state.graphs[next.id] || state.deleted[next.id]) throw new Error("График уже существует");
    if (next.events.length || next.days.length) throw new Error("Новый график должен быть пустым");
    saveCopy(state, current(state));
    const saved = revision(next, current(state));
    state.graphs[saved.id] = saved;
    state.currentId = saved.id;
    return saved;
  }),
  openGraph: id => mutate(state => {
    if (state.deleted[id] || !state.graphs[id]) throw new Error("График недоступен");
    if (id === state.currentId) return current(state);
    saveCopy(state, current(state));
    const saved = revision(state.graphs[id], current(state));
    state.graphs[id] = saved;
    state.currentId = id;
    return saved;
  }),
  deleteGraph: id => mutate(state => {
    const target = state.graphs[id];
    if (!target || state.deleted[id]) throw new Error("График уже удалён");
    state.deleted[id] = { journal: target, deletedAt: new Date().toISOString() };
    delete state.graphs[id];
    if (state.currentId === id)
      state.currentId = Object.keys(state.graphs).find(key => !state.deleted[key]) ?? null;
    return current(state);
  }),
  trash: async () => {
    const state = await read();
    purge(state);
    return Object.entries(state.deleted).filter(([, item]) => item.journal && !item.expired).map(([id, item]) => ({
      id, name: item.journal.settings.name,
      events: item.journal.events.filter(e => !e.deletedAt).length,
      expiresAt: new Date(Date.parse(item.deletedAt) + 30 * 86400000).toISOString(),
    }));
  },
  restoreGraph: id => mutate(state => {
    purge(state);
    const item = state.deleted[id];
    if (!item?.journal || item.expired) throw new Error("Срок восстановления истёк");
    saveCopy(state, current(state));
    const saved = revision(validateJournal(item.journal), current(state));
    state.graphs[id] = saved;
    state.currentId = id;
    delete state.deleted[id];
    return saved;
  }),
  export: async () => {
    const journal = current(await read());
    if (!journal) throw new Error("Сначала создай график");
    const blob = new Blob([JSON.stringify(journal, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `High-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  },
  import: chooseImport,
  backups: async () => "Резервные копии доступны через экспорт JSON. Сохрани файл вне приложения.",
  preferences: async () => ({ initialized: true, autoStart: false, tray: false, autoUpdates: false, platform: "mobile" }),
  configure: async () => { throw new Error("Эта настройка доступна только на компьютере"); },
  updateState: async () => ({ state: "unconfigured", version: "__APP_VERSION__", message: "Мобильные обновления будут доступны через магазин приложений в версии 2.0.", history: RELEASE_HISTORY }),
  checkUpdate: async () => ({ state: "unconfigured", version: "__APP_VERSION__", message: "Обновления будут доступны через магазин приложений в версии 2.0.", history: RELEASE_HISTORY }),
  downloadUpdate: async () => {}, installUpdate: async () => {},
  minimize: () => {}, maximize: () => {}, close: () => {},
});
