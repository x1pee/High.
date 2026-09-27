import { localizeUI, locale } from "./i18n.mjs";
import { calculate } from "./domain.mjs";

export const PRICE_FLOOR = 0.01;
// Historical files stay readable. A mutation may repair an old deficit, but
// must not create a new one or deepen an existing one anywhere in the chain.
export function assertPriceChange(previous, next) {
  if (
    next.settings.initial < PRICE_FLOOR &&
    next.settings.initial < (previous?.settings.initial ?? PRICE_FLOOR)
  )
    throw new Error(localizeUI("Начальное значение должно быть не меньше 0,01."));
  const old = new Map(
    (previous ? calculate(previous) : [])
      .flatMap((d) => d.events)
      .map((e) => [e.id, e.after]),
  );
  for (const event of calculate(next).flatMap((d) => d.events)) {
    const limit = Math.min(PRICE_FLOOR, old.get(event.id) ?? PRICE_FLOOR);
    if (event.after < limit) {
      throw new Error(
        localizeUI`Значение не может опуститься ниже 0,01. Запись «${event.text.slice(0, 60)}» (${event.date}) даёт ${event.after.toLocaleString(locale)}. Уменьши спад или исправь предыдущие записи. Падение на 100% и больше недоступно; рост может превышать 100%.`,
      );
    }
  }
  return next;
}
