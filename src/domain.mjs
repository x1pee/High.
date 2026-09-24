import { validateCoin } from "./coin.mjs";
import { validateAppearance } from "./themes.mjs";
export const VERSION = 2;
export const round = (n) =>
  Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
export const percentage = (delta, base) =>
  base === 0 ? null : round((delta / Math.abs(base)) * 100);
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function validDate(v) {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    v < "1900-01-01" ||
    v > "2200-12-31"
  )
    return false;
  try {
    return new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;
  } catch {
    return false;
  }
}
export function createJournal(
  name = "Мой путь",
  initial = 1000,
  theme = "dark",
) {
  const now = new Date().toISOString();
  return {
    schemaVersion: VERSION,
    id: crypto.randomUUID(),
    revision: 0,
    createdAt: now,
    updatedAt: now,
    settings: {
      name,
      initial,
      theme,
      reducedMotion: false,
      interpolate: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    events: [],
    days: [],
  };
}
const fail = (message) => {
  throw new Error(message);
};
const string = (x, max, label) =>
  (typeof x === "string" && x.length <= max) ||
  fail(`Некорректное поле: ${label}`);
const stamp = (v) =>
  typeof v === "string" &&
  /^\d{4}-\d\d-\d\dT/.test(v) &&
  Number.isFinite(Date.parse(v));
export function validateJournal(input) {
  const x = structuredClone(input);
  if (!x || ![1, VERSION].includes(x.schemaVersion))
    fail("Неизвестная версия файла. Нужен файл «Выше» версии 1 или 2.");
  const legacy = x.schemaVersion === 1;
  x.schemaVersion = VERSION;
  string(x.id, 100, "id");
  if (!x.id) fail("Отсутствует id");
  if (!Number.isSafeInteger(x.revision) || x.revision < 0)
    fail("Некорректная ревизия");
  if (!stamp(x.createdAt) || !stamp(x.updatedAt))
    fail("Некорректные даты изменения");
  const s = x.settings;
  if (!s || typeof s !== "object") fail("Отсутствуют настройки");
  string(s.name, 80, "название");
  if (!s.name.trim()) fail("Нужно название графика");
  if (
    !Number.isFinite(s.initial) ||
    Math.abs(s.initial) > 1e9 ||
    round(s.initial) !== s.initial
  )
    fail(
      "Начальное значение: до миллиарда, не более двух знаков после запятой",
    );
  if (
    !["dark", "light", "system"].includes(s.theme) ||
    typeof s.reducedMotion !== "boolean"
  )
    fail("Некорректная тема");
  validateAppearance(s.appearance);
  validateCoin(s.coin);
  if (s.rhythmStrength !== undefined && ![1, 4, 8].includes(s.rhythmStrength))
    fail("Некорректный ритм");
  if (s.starter !== undefined) {
    const v = s.starter;
    if (
      !v ||
      !Number.isInteger(v.remaining) ||
      v.remaining < 0 ||
      v.remaining > 30 ||
      !Number.isInteger(v.seed) ||
      v.seed < 0 ||
      v.seed > 4294967295 ||
      !Number.isSafeInteger(v.at) ||
      v.at < -36816480 ||
      v.at > 121495680
    )
      fail("Некорректный стартовый ритм");
  }
  for (const key of [
    "followEvent",
    "liveChart",
    "showVolume",
    "eventAnimation",
    "experimentalRandom",
  ])
    if (s[key] !== undefined && typeof s[key] !== "boolean")
      fail("Некорректная настройка графика");
  if (s.eventOrder !== undefined && !["newest", "time"].includes(s.eventOrder))
    fail("Некорректный порядок списка");
  if (s.chartDensity !== undefined && ![45, 90, 180].includes(s.chartDensity))
    fail("Некорректная плотность графика");
  if (s.baselineLevel !== undefined && ![25, 50, 75].includes(s.baselineLevel))
    fail("Некорректный уровень базовой линии");
  if (s.favoriteDays !== undefined) {
    if (
      !Array.isArray(s.favoriteDays) ||
      s.favoriteDays.length > 50000 ||
      s.favoriteDays.some((date) => !validDate(date)) ||
      new Set(s.favoriteDays).size !== s.favoriteDays.length
    )
      fail("Некорректный список избранных дней");
  }
  if (s.interpolate === undefined) s.interpolate = true;
  if (typeof s.interpolate !== "boolean")
    fail("Некорректный режим интерполяции");
  string(s.timeZone, 100, "часовой пояс");
  try {
    new Intl.DateTimeFormat("ru", { timeZone: s.timeZone });
  } catch {
    fail("Некорректный часовой пояс");
  }
  if (
    !Array.isArray(x.events) ||
    !Array.isArray(x.days) ||
    x.events.length > 100000 ||
    x.days.length > 50000
  )
    fail("Слишком много записей или неверный формат");
  const ids = new Set(),
    dates = new Set(),
    orders = new Set();
  for (const [kind, records] of [
    ["event", x.events],
    ["day", x.days],
  ])
    for (const r of records) {
      if (!r || typeof r !== "object") fail("Повреждённая запись");
      string(r.id, 100, "id записи");
      if (!r.id || ids.has(r.id)) fail("Повторяющийся id");
      ids.add(r.id);
      if (!validDate(r.date) || !stamp(r.createdAt) || !stamp(r.updatedAt))
        fail("Некорректная дата записи");
      if (r.deletedAt !== null && !stamp(r.deletedAt))
        fail("Некорректная отметка удаления");
      if (kind === "event") {
        r.unit = legacy ? "points" : (r.unit ?? "points");
        if (!["points", "percent"].includes(r.unit))
          fail("Некорректная единица изменения");
        if (r.test !== undefined && typeof r.test !== "boolean")
          fail("Некорректная отметка тестовой записи");
        if (r.quickMove !== undefined) {
          const move = r.quickMove;
          if (
            !move ||
            !["up", "down"].includes(move.direction) ||
            !Number.isSafeInteger(move.count) ||
            move.count < 1 ||
            move.count > 100000 ||
            !Number.isInteger(move.stage) ||
            move.stage < 1 ||
            move.stage > 4 ||
            !Number.isInteger(move.variant) ||
            move.variant < 0 ||
            move.variant > 9
          )
            fail("Некорректное быстрое изменение графика");
          if (move.lastAt !== undefined && !stamp(move.lastAt))
            fail("Некорректное время быстрого изменения графика");
        }
        string(r.text, 4000, "событие");
        if (!r.text.trim()) fail("Событие не может быть пустым");
        if (r.time === undefined) r.time = "12:00";
        if (
          typeof r.time !== "string" ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)
        )
          fail("Некорректное время события");
        if (
          !Number.isFinite(r.delta) ||
          Math.abs(r.delta) > 1e7 ||
          round(r.delta) !== r.delta
        )
          fail(
            "Изменение: до 10 миллионов, не более двух знаков после запятой",
          );
        if (!Number.isSafeInteger(r.order) || r.order < 0)
          fail("Некорректный порядок событий");
        const key = r.date + ":" + r.order;
        if (!r.deletedAt && orders.has(key))
          fail("Повторяющийся порядок событий");
        if (!r.deletedAt) orders.add(key);
      } else {
        string(r.title, 120, "название дня");
        string(r.note, 12000, "описание дня");
        if (!r.deletedAt && dates.has(r.date))
          fail("Повторяющаяся дата заметки");
        if (!r.deletedAt) dates.add(r.date);
      }
    }
  calculate(x); // Reject unbounded percentage chains before writing to disk.
  return x;
}
export function calculate(journal) {
  const map = new Map();
  const get = (date) => {
    if (!map.has(date))
      map.set(date, { date, events: [], title: "", note: "", recorded: true });
    return map.get(date);
  };
  for (const d of journal.days)
    if (!d.deletedAt)
      Object.assign(get(d.date), { title: d.title, note: d.note });
  for (const e of journal.events) if (!e.deletedAt) get(e.date).events.push(e);
  let value = journal.settings.initial;
  return [...map.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const open = value;
      let high = value,
        low = value;
      const events = day.events.sort(compareEvents).map((e) => {
        const before = value;
        const delta =
          e.unit === "percent"
            ? round((Math.abs(before) * e.delta) / 100)
            : e.delta;
        value = round(value + delta);
        if (!Number.isFinite(value) || Math.abs(value) > 1e15)
          fail(
            "Итог графика слишком велик. Уменьши изменение или начальное значение.",
          );
        high = Math.max(high, value);
        low = Math.min(low, value);
        return {
          ...e,
          inputValue: e.delta,
          delta,
          before,
          after: value,
          percent: percentage(delta, before),
        };
      });
      const delta = round(value - open);
      return {
        ...day,
        events,
        open,
        high,
        low,
        close: value,
        delta,
        percent: percentage(delta, open),
      };
    });
}
export function calendar(candles, initial, start, end) {
  const map = new Map(candles.map((c) => [c.date, c]));
  let value = initial;
  for (const c of candles) {
    if (c.date >= start) break;
    value = c.close;
  }
  const out = [];
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    const c = map.get(date) || {
      date,
      open: value,
      close: value,
      high: value,
      low: value,
      delta: 0,
      percent: percentage(0, value),
      recorded: false,
      title: "",
      note: "",
      events: [],
    };
    value = c.close;
    out.push(c);
  }
  return out;
}
export function compareEvents(a, b) {
  return (
    (a.time ?? "12:00").localeCompare(b.time ?? "12:00") ||
    a.order - b.order ||
    a.id.localeCompare(b.id)
  );
}
export function localTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function upsertEvent(journal, fields, id) {
  fields = { time: localTime(), unit: "points", ...fields };
  const next = structuredClone(journal),
    now = new Date().toISOString();
  let e = next.events.find((e) => e.id === id && !e.deletedAt);
  const order =
    next.events.reduce(
      (max, e) =>
        !e.deletedAt && e.date === fields.date && e.id !== id
          ? Math.max(max, e.order)
          : max,
      -1,
    ) + 1;
  if (e)
    Object.assign(e, fields, {
      order: e.date === fields.date ? e.order : order,
      updatedAt: now,
    });
  else
    next.events.push({
      ...fields,
      id: crypto.randomUUID(),
      order,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  if (!e && next.settings.starter?.remaining > 0 && !fields.test)
    next.settings.starter.remaining--;
  return next;
}
export function upsertDay(journal, fields) {
  const next = structuredClone(journal),
    now = new Date().toISOString();
  const d = next.days.find((d) => d.date === fields.date && !d.deletedAt);
  if (d) Object.assign(d, fields, { updatedAt: now });
  else
    next.days.push({
      ...fields,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  return next;
}
export function widgetSnapshot(journal, date = localDate()) {
  const candles = calculate(journal),
    past = candles.filter((c) => c.date <= date),
    day = past.find((c) => c.date === date);
  return {
    schemaVersion: 1,
    graphId: journal.id,
    name: journal.settings.name,
    date,
    timeZone: journal.settings.timeZone,
    value: past.at(-1)?.close ?? journal.settings.initial,
    delta: day?.delta ?? 0,
    percent: day?.percent ?? null,
    recorded: !!day,
    series: past.slice(-30).map((c) => ({ date: c.date, value: c.close })),
    updatedAt: journal.updatedAt,
  };
}
export function demoJournal() {
  let j = createJournal("Мой путь", 1000, "dark");
  const now = new Date(),
    nowMinute = now.getHours() * 60 + now.getMinutes();
  const demoTime = (part) => {
    const minute = Math.floor(nowMinute * part);
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  };
  const titles = [
    "Маленькая победа",
    "Просто хороший день",
    "День для себя",
    "Новый ритм",
    "Не всё по плану",
    "Важный разговор",
    "Снова в движении",
  ];
  const texts = [
    "Прогулка без телефона",
    "Закончил то, что откладывал",
    "Устал и разрешил себе отдохнуть",
    "Ужин с близким человеком",
    "Хорошая тренировка",
    "Не успел сделать запланированное",
    "Прочитал несколько глав",
    "Встретился с друзьями",
  ];
  for (let i = 0; i < 75; i++) {
    if (i % 13 === 4) continue;
    const date = shiftDate(localDate(), i - 74),
      down = i % 7 === 4 || i % 9 === 2;
    j = upsertEvent(j, {
      date,
      time: i === 74 ? demoTime(0.4) : "10:20",
      text: down
        ? "Тяжёлое утро, многое пошло не по плану"
        : texts[[0, 1, 3, 4, 6, 7][i % 6]],
      delta: down ? -25 - (i % 12) : 12 + (i % 21),
    });
    j = upsertEvent(j, {
      date,
      time: i === 74 ? demoTime(0.8) : "18:45",
      text:
        i % 3 === 0
          ? "Не успел сделать запланированное"
          : "Вечерняя прогулка помогла выдохнуть",
      delta: i % 3 === 0 ? -15 : 8 + (i % 8),
    });
    if (i % 3 === 0 || i === 74)
      j = upsertDay(j, {
        date,
        title: titles[i % 7],
        note: "Сегодня получилось остановиться и заметить, сколько хорошего есть вокруг. Не всё было идеально — и это нормально. Продолжаю свой путь.",
      });
  }
  return j;
}
