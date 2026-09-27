import { localizeUI } from "./i18n.mjs";
import libraryModule from '../desktop/library.cjs';
import { validateJournal } from './domain.mjs';
import { RELEASE_HISTORY } from './release-history.mjs';
import { check as checkForUpdate } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { createUpdateClient } from './update-client.mjs';
const invoke = (command, args) => window.__TAURI__.core.invoke(command, args)
  .catch(raw => { throw new Error(raw?.message ?? String(raw)); });
const library = new libraryModule.GraphLibrary('', validateJournal);
const initial = await library.init();
let flushUi = async () => {};
let appPreferences = await invoke('preferences');
if (appPreferences.platform === 'mobile') document.documentElement.classList.add('mobile-runtime');
else {
  document.querySelector('.titlebar')?.setAttribute('data-tauri-drag-region', '');
  document.querySelectorAll('.titlebar > span').forEach(node => node.setAttribute('data-tauri-drag-region', ''));
}
const updateClient = createUpdateClient({
  check: async () => {
    if (appPreferences.platform !== 'win32') return checkForUpdate();
    const offer = await invoke('check_portable_update');
    return offer ? {
      version: offer.displayVersion || offer.version,
      download: async onEvent => {
        const unlisten = await window.__TAURI__.event.listen(
          'portable-update-progress',
          event => onEvent(event.payload),
        );
        try {
          return await invoke('download_portable_update');
        } finally {
          unlisten();
        }
      },
      install: async () => invoke('install_portable_update'),
    } : null;
  },
  relaunch: async () => {
    if (appPreferences.platform !== 'win32') await relaunch();
  },
  getPreferences: () => appPreferences,
  version: '__APP_VERSION__',
  history: RELEASE_HISTORY,
  flush: async () => { await flushUi(); await library.queue; },
});
let autoCheckTimer = null;
const scheduleAutomaticCheck = () => {
  if (autoCheckTimer !== null || appPreferences.portable || !appPreferences.autoUpdates) return;
  autoCheckTimer = setTimeout(async () => {
    autoCheckTimer = null;
    if (!appPreferences.autoUpdates || appPreferences.portable) return;
    const state = await updateClient.checkUpdate();
    document.querySelector('#updates')?.classList.toggle('update-ready', state.state === 'available');
  }, 1800);
};
scheduleAutomaticCheck();
window.desktop = Object.freeze({
  beforeClose: callback => { if (typeof callback === 'function') flushUi = callback; },
  load: async () => ({ ...initial, journal: library.current }),
  save: (data, revision, replace) => library.save(data, revision, replace),
  graphs: () => library.list(), createGraph: data => library.create(data),
  openGraph: id => library.open(id), deleteGraph: id => library.remove(id),
  trash: () => library.trash(), restoreGraph: id => library.restore(id),
  preferences: async () => { appPreferences = await invoke('preferences'); return appPreferences; },
  configure: async data => {
    appPreferences = await invoke('configure', { data });
    scheduleAutomaticCheck();
    return appPreferences;
  },
  export: async () => {
    await library.queue;
    if (!library.current) throw new Error(localizeUI('Сначала создай график'));
    return invoke('export_journal', { data: JSON.stringify(library.current, null, 2) });
  },
  import: async () => {
    const data = await invoke('import_journal');
    return data === null ? null : validateJournal(JSON.parse(data));
  },
  backups: () => invoke('open_backups'),
  updateState: async () => updateClient.updateState(),
  checkUpdate: updateClient.checkUpdate,
  downloadUpdate: updateClient.downloadUpdate,
  installUpdate: updateClient.installUpdate,
  minimize: () => invoke('window_action', { action: 'minimize' }),
  maximize: () => invoke('window_action', { action: 'maximize' }),
  close: async () => { await flushUi(); await library.queue; await invoke('window_action', { action: 'close' }); },
});
await window.__TAURI__.event.listen('native-close-request', () => window.desktop.close());
await invoke('ui_ready');
