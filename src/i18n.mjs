import english from './locale-en.mjs';

export const LANGUAGE_KEY = 'high-language';
export function readLanguage(storage) {
  try { return (storage ?? globalThis.localStorage)?.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ru'; }
  catch { return 'ru'; }
}
export const language = readLanguage();
export const locale = language === 'en' ? 'en-US' : 'ru-RU';
export function saveLanguage(value, storage = globalThis.localStorage) {
  if (!['ru', 'en'].includes(value)) throw new Error('Unsupported language');
  storage.setItem(LANGUAGE_KEY, value);
}
export const interfaceFragments = /[А-Яа-яЁё][^<>"'`{}\r\n]*/g;
export function translateStatic(source, target = language) {
  if (target !== 'en') return source;
  return source.replace(interfaceFragments, fragment => {
    const key = fragment.trimEnd();
    return (english[key] ?? key) + fragment.slice(key.length);
  });
}
// Tagged templates translate static source only. Interpolated journal content,
// escaped HTML and data values are preserved byte-for-byte.
export function localizeUI(source, ...values) {
  if (typeof source === 'string') return translateStatic(source);
  return source.reduce((result, part, index) =>
    result + translateStatic(part) + (index < values.length ? String(values[index]) : ''), '');
}
