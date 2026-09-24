const STAGES = [
  {
    threshold: 1,
    up: [
      "Тик спроса",
      "Зелёный сигнал",
      "Лёгкий заход",
      "Первый бид",
      "Лента ожила",
      "Покупатель на месте",
      "Импульс снизу",
      "Короткий рывок",
      "Свеча зажглась",
      "Спрос подал знак",
    ],
    down: [
      "Красный сигнал",
      "Первый аск",
      "Лента остыла",
      "Локальный откат",
      "Спрос притих",
      "Продажа на старте",
      "Шаг вниз",
      "Свеча потяжелела",
      "Тихий отток",
      "Импульс к опоре",
    ],
  },
  {
    threshold: 5,
    up: [
      "Биды держат темп",
      "Выкуп пошёл",
      "Спрос перехватывает",
      "Зелёная серия",
      "Покупатели давят",
      "Рынок оживился",
      "Уровень под натиском",
      "Разгон начался",
      "Лента ускорилась",
      "Импульс крепнет",
    ],
    down: [
      "Аски перевесили",
      "Продажи усилились",
      "Красная серия",
      "Откат набирает ход",
      "Спрос отступает",
      "Уровень не удержан",
      "Давление продавцов",
      "Спуск ускорился",
      "Выход из позиции",
      "Лента тяжелеет",
    ],
  },
  {
    threshold: 10,
    up: [
      "Спрос ведёт рынок",
      "Уверенное ралли",
      "Пробой набирает силу",
      "Зелёный разгон",
      "Покупатели перехватили ход",
      "Цена выходит выше",
      "Выкуп без паузы",
      "Свечи ускоряются",
      "Восходящий импульс",
      "Движение закрепляется",
    ],
    down: [
      "Продавцы ведут рынок",
      "Снижение ускоряется",
      "Поддержка сдана",
      "Красный разгон",
      "Выход из диапазона",
      "Покупатели теряют темп",
      "Давление нарастает",
      "Серия ликвидаций",
      "Откат становится трендом",
      "Продавцы перехватили ход",
    ],
  },
  {
    threshold: 20,
    up: [
      "Крупный игрок выкупает",
      "Стакан смели вверх",
      "Киты заходят в позицию",
      "Большой зелёный импульс",
      "Спрос перехватил рынок",
      "Пробой с продолжением",
      "Мощная волна выкупа",
      "Цена взяла высоту",
      "Рынок развернули вверх",
      "Покупатели задают тренд",
    ],
    down: [
      "Крупный игрок разгружается",
      "Стакан продавили вниз",
      "Киты выходят из позиции",
      "Большая волна продаж",
      "Предложение перехватило рынок",
      "Пробой вниз с продолжением",
      "Массовая фиксация",
      "Цена потеряла опору",
      "Рынок развернули вниз",
      "Продавцы задают тренд",
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
