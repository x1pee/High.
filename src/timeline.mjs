import { calendar, percentage } from "./domain.mjs";
import { intraday, clockLabel } from "./intraday.mjs";

// Calendar coordinates, deliberately independent of DST or the device time zone.
export const minuteAt = (date, minute = 0) =>
  Date.parse(date + "T00:00:00Z") / 60000 + minute;
export const dateAt = (minute) =>
  new Date(minute * 60000).toISOString().slice(0, 10);
export const DEFAULT_BARS = { 1: 180, 5: 144, 15: 128, 60: 168, 240: 126 };
export const MAX_BARS = 2400;
// A wheel zoom redraws nearby windows repeatedly. Keep each day's expensive
// intraday interpolation so redraws can reuse it while the journal is unchanged.
const intradayDayCache = new WeakMap();
const firstEventCache = new WeakMap();
export function timeline(
  days,
  initial,
  interval,
  start,
  end,
  interpolate = true,
  observedEnd = end,
  strength = 1,
) {
  end = Math.min(end, observedEnd);
  if (end <= start || !days.some((d) => d.events.length)) return [];
  start = Math.max(start, end - interval * MAX_BARS);
  const first = dateAt(start),
    last = dateAt(end - 1);
  const range = calendar(days, initial, first, last);
  const result = [];
  for (const day of range) {
    const origin = minuteAt(day.date),
      // Anchors depend on recorded history and the current clock, never on panning.
      until = Math.min(1440, observedEnd - origin);
    const cacheKey = `${interval}|${interpolate ? 1 : 0}|${until}|${strength}`;
    let dayCache = intradayDayCache.get(day);
    let bars = dayCache?.get(cacheKey);
    if (!bars) {
      const events = day.events.filter((e) => {
        const [h, m] = e.time.split(":").map(Number);
        return h * 60 + m < until;
      });
      const safeDay = { ...day, events, close: events.at(-1)?.after ?? day.open };
      bars = intraday(safeDay, interval, { interpolate, until, strength });
      if (!dayCache) {
        dayCache = new Map();
        intradayDayCache.set(day, dayCache);
      }
      dayCache.set(cacheKey, bars);
      if (dayCache.size > 12) dayCache.delete(dayCache.keys().next().value);
    }
    if (!bars.length) {
      // Missing observations remain flat and neutral, never artificial movement.
      for (let t = 0; t < until; t += interval)
        bars.push({
          date: day.date,
          time: clockLabel(t),
          endTime: clockLabel(Math.min(until, t + interval)),
          startMinute: t,
          endMinute: Math.min(until, t + interval),
          open: day.open,
          close: day.open,
          high: day.open,
          low: day.open,
          delta: 0,
          percent: percentage(0, day.open),
          recorded: false,
          synthetic: false,
          intraday: true,
          title: "",
          note: "",
          events: [],
          realDelta: 0,
        });
    }
    for (const bar of bars) {
      const from = origin + bar.startMinute,
        to = origin + bar.endMinute;
      if (to > start && from < end) result.push({ ...bar, from, to });
    }
  }
  // An empty window must not imply that any observations were made there.
  let firstEvent = firstEventCache.get(days);
  if (firstEvent === undefined) {
    firstEvent = Infinity;
    for (const day of days) {
      const origin = minuteAt(day.date);
      for (const event of day.events) {
        const minute = Number(event.time.slice(0, 2)) * 60 + Number(event.time.slice(3));
        firstEvent = Math.min(firstEvent, origin + minute);
      }
    }
    firstEventCache.set(days, firstEvent);
  }
  return result.filter((c) => c.to > firstEvent);
}

const UP = [
  [
    "Маленький шажок",
    "Тихий плюс",
    "На полшага выше",
    "Первый зелёный тик",
    "Тёплый отскок",
    "Плюс без спешки",
    "Рост по крупицам",
    "Чуть выше опоры",
    "Маленькая зелёная свеча",
    "На один тик ближе",
  ],
  [
    "Набирая высоту",
    "Зелёная волна",
    "Поймал попутный ветер",
    "Отскок от поддержки",
    "Покупатели настроения",
    "Укрепляю позиции",
    "Спокойный ап-тренд",
    "Выше вчерашнего уровня",
    "Плюс набирает силу",
    "Спрос на хороший день",
  ],
  [
    "Уверенный разгон",
    "Выход на новый уровень",
    "День с импульсом",
    "Зелёный коридор",
    "Пробой сопротивления",
    "Быки вышли на сцену",
    "Закрепление выше",
    "Импульс продолжения",
    "Новая ступень тренда",
    "Набираю обороты",
  ],
  [
    "Сильный пробой вверх",
    "На гребне волны",
    "Ралли настроения",
    "День мощного пампа",
    "Ускорение тренда",
    "Зелёный прорыв",
    "Рывок через сопротивление",
    "Бычий разбег",
    "Свеча с характером",
    "Высота взята",
  ],
  [
    "Своя луна",
    "Большой рывок",
    "Зелёный взлёт",
    "Памп на весь день",
    "Полетели выше",
    "Ракетная свеча",
    "За пределами диапазона",
    "Бычий праздник",
    "День большого импульса",
    "Личный выход на орбиту",
  ],
];
const DOWN = [
  [
    "Лёгкая рябь",
    "Небольшой откат",
    "Шаг на выдохе",
    "Красный тик",
    "Короткая передышка",
    "Микрокоррекция",
    "На полшага ниже",
    "Тень на зелёном пути",
    "Небольшая пауза тренда",
    "Откат на один уровень",
  ],
  [
    "Красная волна",
    "Проверка опоры",
    "Встречный ветер",
    "Тест поддержки",
    "Медведи на горизонте",
    "Отступление к опоре",
    "День лёгкой коррекции",
    "Под давлением",
    "Ретест настроения",
    "Минус без паники",
  ],
  [
    "Зона турбулентности",
    "Глубокий ретест",
    "День коррекции",
    "Медвежий заход",
    "Поиск новой опоры",
    "Откат после разгона",
    "Проверка на прочность",
    "Красный коридор",
    "Коррекция с характером",
    "У нижней границы",
  ],
  [
    "Резкая просадка",
    "Красный шторм",
    "Сильная встряска",
    "Пробой вниз",
    "День сильного давления",
    "Медвежий импульс",
    "Поддержка под ударом",
    "Глубокий откат",
    "Красная лавина",
    "Трудный участок тренда",
  ],
  [
    "Чёрный день графика",
    "В эпицентре шторма",
    "Крутое пике",
    "Резкий дамп",
    "Медвежья буря",
    "Штормовая свеча",
    "Большая просадка",
    "День обвала",
    "За нижней границей",
    "Испытание большой волной",
  ],
];
export function candleTitle(c) {
  if (c.title) return c.title;
  if (!c.recorded) return c.synthetic ? "Промежутки" : "Без новых записей";
  if (!c.delta) return "На своей отметке";
  const size = Math.abs(c.percent ?? 0);
  const tier = size < 0.3 ? 0 : size < 1 ? 1 : size < 3 ? 2 : size < 7 ? 3 : 4;
  let seed = 0;
  for (const char of c.date + (c.time ?? ""))
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const variants = (c.delta > 0 ? UP : DOWN)[tier];
  return variants[seed % variants.length];
}
export function movingAverage(bars, length = 14) {
  let sum = 0;
  return bars.map((c, i) => {
    sum += c.close;
    if (i >= length) sum -= bars[i - length].close;
    return i < length - 1 ? null : sum / length;
  });
}
