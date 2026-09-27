import { localizeUI } from "./i18n.mjs";
const STAGES = [
  {
    threshold: 1,
    up: [
      localizeUI("Тик спроса"),
      localizeUI("Зелёный сигнал"),
      localizeUI("Лёгкий заход"),
      localizeUI("Первый бид"),
      localizeUI("Лента ожила"),
      localizeUI("Покупатель на месте"),
      localizeUI("Импульс снизу"),
      localizeUI("Короткий рывок"),
      localizeUI("Свеча зажглась"),
      localizeUI("Спрос подал знак"),
    ],
    down: [
      localizeUI("Красный сигнал"),
      localizeUI("Первый аск"),
      localizeUI("Лента остыла"),
      localizeUI("Локальный откат"),
      localizeUI("Спрос притих"),
      localizeUI("Продажа на старте"),
      localizeUI("Шаг вниз"),
      localizeUI("Свеча потяжелела"),
      localizeUI("Тихий отток"),
      localizeUI("Импульс к опоре"),
    ],
  },
  {
    threshold: 5,
    up: [
      localizeUI("Биды держат темп"),
      localizeUI("Выкуп пошёл"),
      localizeUI("Спрос перехватывает"),
      localizeUI("Зелёная серия"),
      localizeUI("Покупатели давят"),
      localizeUI("Рынок оживился"),
      localizeUI("Уровень под натиском"),
      localizeUI("Разгон начался"),
      localizeUI("Лента ускорилась"),
      localizeUI("Импульс крепнет"),
    ],
    down: [
      localizeUI("Аски перевесили"),
      localizeUI("Продажи усилились"),
      localizeUI("Красная серия"),
      localizeUI("Откат набирает ход"),
      localizeUI("Спрос отступает"),
      localizeUI("Уровень не удержан"),
      localizeUI("Давление продавцов"),
      localizeUI("Спуск ускорился"),
      localizeUI("Выход из позиции"),
      localizeUI("Лента тяжелеет"),
    ],
  },
  {
    threshold: 10,
    up: [
      localizeUI("Спрос ведёт рынок"),
      localizeUI("Уверенное ралли"),
      localizeUI("Пробой набирает силу"),
      localizeUI("Зелёный разгон"),
      localizeUI("Покупатели перехватили ход"),
      localizeUI("Цена выходит выше"),
      localizeUI("Выкуп без паузы"),
      localizeUI("Свечи ускоряются"),
      localizeUI("Восходящий импульс"),
      localizeUI("Движение закрепляется"),
    ],
    down: [
      localizeUI("Продавцы ведут рынок"),
      localizeUI("Снижение ускоряется"),
      localizeUI("Поддержка сдана"),
      localizeUI("Красный разгон"),
      localizeUI("Выход из диапазона"),
      localizeUI("Покупатели теряют темп"),
      localizeUI("Давление нарастает"),
      localizeUI("Серия ликвидаций"),
      localizeUI("Откат становится трендом"),
      localizeUI("Продавцы перехватили ход"),
    ],
  },
  {
    threshold: 20,
    up: [
      localizeUI("Крупный игрок выкупает"),
      localizeUI("Стакан смели вверх"),
      localizeUI("Киты заходят в позицию"),
      localizeUI("Большой зелёный импульс"),
      localizeUI("Спрос перехватил рынок"),
      localizeUI("Пробой с продолжением"),
      localizeUI("Мощная волна выкупа"),
      localizeUI("Цена взяла высоту"),
      localizeUI("Рынок развернули вверх"),
      localizeUI("Покупатели задают тренд"),
    ],
    down: [
      localizeUI("Крупный игрок разгружается"),
      localizeUI("Стакан продавили вниз"),
      localizeUI("Киты выходят из позиции"),
      localizeUI("Большая волна продаж"),
      localizeUI("Предложение перехватило рынок"),
      localizeUI("Пробой вниз с продолжением"),
      localizeUI("Массовая фиксация"),
      localizeUI("Цена потеряла опору"),
      localizeUI("Рынок развернули вниз"),
      localizeUI("Продавцы задают тренд"),
    ],
  },
];

export const QUICK_MOVE_WINDOW_MS = 5 * 60 * 1000;

export function quickMoveStage(count) {
  let stage = 0;
  for (let i = 1; i < STAGES.length; i++) {
    if (count < STAGES[i].threshold) break;
    stage = i;
  }
  return stage + 1;
}

export function recentQuickMove(
  events,
  direction,
  date,
  now = Date.now(),
  windowMs = QUICK_MOVE_WINDOW_MS,
) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  let recent = null;
  let recentAt = -Infinity;
  for (const event of events) {
    if (
      event.deletedAt ||
      event.date !== date ||
      event.quickMove?.direction !== direction ||
      !Number.isSafeInteger(event.quickMove?.count)
    )
      continue;
    // Older builds stored one quick-move event per click and have no lastAt.
    const at = Date.parse(event.quickMove.lastAt ?? event.createdAt);
    const age = nowMs - at;
    if (!Number.isFinite(at) || age < 0 || age > windowMs || at <= recentAt)
      continue;
    recent = event;
    recentAt = at;
  }
  return recent;
}

export function chooseQuickMove(
  direction,
  count,
  random = Math.random,
  previousVariant = -1,
) {
  const stage = Math.max(1, Math.min(STAGES.length, quickMoveStage(count)));
  const names = STAGES[stage - 1][direction === "down" ? "down" : "up"];
  const randomValue = Number(random());
  let variant = Math.max(
    0,
    Math.min(names.length - 1, Math.floor(randomValue * names.length)),
  );
  if (variant === previousVariant) variant = (variant + 1) % names.length;
  return {
    stage,
    variant,
    text: `${names[variant]} (x${count})`,
  };
}
