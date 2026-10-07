import { localizeUI } from "./i18n.mjs";
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
      bars = intraday(safeDay, interval, { interpolate, until, strength, visualEmpty: true });
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
    localizeUI("Маленький шажок"),
    localizeUI("Тихий плюс"),
    localizeUI("На полшага выше"),
    localizeUI("Первый зелёный тик"),
    localizeUI("Тёплый отскок"),
    localizeUI("Плюс без спешки"),
    localizeUI("Рост по крупицам"),
    localizeUI("Чуть выше опоры"),
    localizeUI("Маленькая зелёная свеча"),
    localizeUI("На один тик ближе"),
  ],
  [
    localizeUI("Набирая высоту"),
    localizeUI("Зелёная волна"),
    localizeUI("Поймал попутный ветер"),
    localizeUI("Отскок от поддержки"),
    localizeUI("Покупатели настроения"),
    localizeUI("Укрепляю позиции"),
    localizeUI("Спокойный ап-тренд"),
    localizeUI("Выше вчерашнего уровня"),
    localizeUI("Плюс набирает силу"),
    localizeUI("Спрос на хороший день"),
  ],
  [
    localizeUI("Уверенный разгон"),
    localizeUI("Выход на новый уровень"),
    localizeUI("День с импульсом"),
    localizeUI("Зелёный коридор"),
    localizeUI("Пробой сопротивления"),
    localizeUI("Быки вышли на сцену"),
    localizeUI("Закрепление выше"),
    localizeUI("Импульс продолжения"),
    localizeUI("Новая ступень тренда"),
    localizeUI("Набираю обороты"),
  ],
  [
    localizeUI("Сильный пробой вверх"),
    localizeUI("На гребне волны"),
    localizeUI("Ралли настроения"),
    localizeUI("День мощного пампа"),
    localizeUI("Ускорение тренда"),
    localizeUI("Зелёный прорыв"),
    localizeUI("Рывок через сопротивление"),
    localizeUI("Бычий разбег"),
    localizeUI("Свеча с характером"),
    localizeUI("Высота взята"),
  ],
  [
    localizeUI("Своя луна"),
    localizeUI("Большой рывок"),
    localizeUI("Зелёный взлёт"),
    localizeUI("Памп на весь день"),
    localizeUI("Полетели выше"),
    localizeUI("Ракетная свеча"),
    localizeUI("За пределами диапазона"),
    localizeUI("Бычий праздник"),
    localizeUI("День большого импульса"),
    localizeUI("Личный выход на орбиту"),
  ],
];
const DOWN = [
  [
    localizeUI("Лёгкая рябь"),
    localizeUI("Небольшой откат"),
    localizeUI("Шаг на выдохе"),
    localizeUI("Красный тик"),
    localizeUI("Короткая передышка"),
    localizeUI("Микрокоррекция"),
    localizeUI("На полшага ниже"),
    localizeUI("Тень на зелёном пути"),
    localizeUI("Небольшая пауза тренда"),
    localizeUI("Откат на один уровень"),
  ],
  [
    localizeUI("Красная волна"),
    localizeUI("Проверка опоры"),
    localizeUI("Встречный ветер"),
    localizeUI("Тест поддержки"),
    localizeUI("Медведи на горизонте"),
    localizeUI("Отступление к опоре"),
    localizeUI("День лёгкой коррекции"),
    localizeUI("Под давлением"),
    localizeUI("Ретест настроения"),
    localizeUI("Минус без паники"),
  ],
  [
    localizeUI("Зона турбулентности"),
    localizeUI("Глубокий ретест"),
    localizeUI("День коррекции"),
    localizeUI("Медвежий заход"),
    localizeUI("Поиск новой опоры"),
    localizeUI("Откат после разгона"),
    localizeUI("Проверка на прочность"),
    localizeUI("Красный коридор"),
    localizeUI("Коррекция с характером"),
    localizeUI("У нижней границы"),
  ],
  [
    localizeUI("Резкая просадка"),
    localizeUI("Красный шторм"),
    localizeUI("Сильная встряска"),
    localizeUI("Пробой вниз"),
    localizeUI("День сильного давления"),
    localizeUI("Медвежий импульс"),
    localizeUI("Поддержка под ударом"),
    localizeUI("Глубокий откат"),
    localizeUI("Красная лавина"),
    localizeUI("Трудный участок тренда"),
  ],
  [
    localizeUI("Чёрный день графика"),
    localizeUI("В эпицентре шторма"),
    localizeUI("Крутое пике"),
    localizeUI("Резкий дамп"),
    localizeUI("Медвежья буря"),
    localizeUI("Штормовая свеча"),
    localizeUI("Большая просадка"),
    localizeUI("День обвала"),
    localizeUI("За нижней границей"),
    localizeUI("Испытание большой волной"),
  ],
];
export function candleTitle(c) {
  if (c.title) return c.title;
  if (!c.recorded) return c.synthetic ? localizeUI("Промежутки") : localizeUI("Без новых записей");
  if (!c.delta) return localizeUI("На своей отметке");
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
