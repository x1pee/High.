import { localizeUI } from "./i18n.mjs";
import { percentage, round } from "./domain.mjs";
import { clockLabel, minuteOf } from "./intraday.mjs";
import { recordedGroups, rhythmBars } from "./rhythm.mjs";

// Calendar coordinates, deliberately independent of DST or the device time zone.
export const minuteAt = (date, minute = 0) =>
  Date.parse(date + "T00:00:00Z") / 60000 + minute;
export const dateAt = (minute) =>
  new Date(minute * 60000).toISOString().slice(0, 10);
export const DEFAULT_BARS = { 1: 180, 5: 144, 15: 128, 60: 168, 240: 126 };
export const MAX_BARS = 2400;
// Calendar days are metadata only: a visual gap can cross midnight without
// restarting its shape or forgetting the last actual impulse. Weak keys release
// the history index when a journal recalculation replaces its array.
const historyCache = new WeakMap();
export function timeline(
  days,
  initial,
  interval,
  start,
  end,
  interpolate = true,
  observedEnd = end,
  strength = 4,
) {
  if (![1, 5, 15, 60, 240].includes(interval))
    throw new Error("Unsupported interval");
  end = Math.min(end, observedEnd);
  if (end <= start) return [];
  let history = historyCache.get(days);
  if (!history) {
    const events = days.flatMap(day => day.events.map(event => ({
      ...event, date: day.date,
      at: minuteAt(day.date, minuteOf(event.time ?? "12:00")), source: event,
    }))).sort((a, b) => a.at - b.at || a.order - b.order);
    history = { events, days: new Map(days.map(day => [day.date, day])), groups: new Map() };
    historyCache.set(days, history);
  }
  const firstEvent = history.events[0]?.at;
  if (firstEvent === undefined || firstEvent >= end) return [];
  start = Math.max(start, end - interval * MAX_BARS);
  start = Math.floor(Math.max(start, firstEvent) / interval) * interval;
  // Reuse repeated pans/zooms, but replace a clock tick's group index instead of
  // retaining another entire copy of a potentially very large journal.
  const cached = history.groups.get(interval);
  let groups = cached?.horizon === observedEnd ? cached.groups : null;
  if (!groups) {
    groups = recordedGroups(history.events, interval, observedEnd);
    history.groups.set(interval, { horizon: observedEnd, groups });
  }
  return rhythmBars(groups, initial, interval, start, end, interpolate, strength, observedEnd)
    .map(bar => {
      const date = dateAt(bar.from), origin = minuteAt(date);
      return {
        date, time: clockLabel(bar.from - origin), endTime: clockLabel(bar.to - origin),
        open: bar.open, close: bar.close, high: bar.high, low: bar.low,
        delta: bar.close - bar.open,
        percent: percentage(bar.close - bar.open, bar.open),
        recorded: bar.events.length > 0, synthetic: interpolate, intraday: true,
        title: history.days.get(date)?.title ?? "", note: "", events: bar.events,
        realDelta: round(bar.events.reduce((sum, event) => sum + event.delta, 0)),
        startMinute: bar.from - origin, endMinute: bar.to - origin,
        from: bar.from, to: bar.to,
      };
    });
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
