// Native side accepts only journal/profile paths, never arbitrary filesystem paths.
const call = async (op, file, extra = {}) => {
  try { return await window.__TAURI__.core.invoke('profile_io', { op, file, ...extra }); }
  catch (raw) {
    const error = new Error(raw?.message ?? String(raw));
    error.code = raw?.code;
    throw error;
  }
};
export const mkdir = file => call('mkdir', file);
export const readFile = file => call('read', file);
export const writeFile = (file, data) => call('write', file, { data });
export const readdir = file => call('list', file);
export const unlink = file => call('remove', file);
export const access = file => call('access', file);
export const copyFile = (file, target) => call('copy', file, { target });
export const rename = (file, target) => call('rename', file, { target });
export const stat = async file => {
  const mtimeMs = await call('stat', file);
  return { mtimeMs, mtime: new Date(mtimeMs) };
};
export const open = async file => {
  let data = '';
  return {
    writeFile: async value => { data = value; },
    // The native write includes sync_all before returning.
    sync: async () => writeFile(file, data),
    close: async () => {},
  };
};
