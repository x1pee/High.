import { localizeUI } from "./i18n.mjs";
import { percentage, round } from "./domain.mjs";

function asUtcDate(date) {
  const value = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(value.getTime())) throw new Error(localizeUI("Некорректная дата"));
  return value;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function periodBounds(anchor, period = "week") {
  const date = asUtcDate(anchor);
  if (period === "week") {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - mondayOffset);
    const start = isoDate(date);
    date.setUTCDate(date.getUTCDate() + 6);
    return { start, end: isoDate(date) };
  }
  if (period === "month") {
    date.setUTCDate(1);
    const start = isoDate(date);
    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCDate(0);
    return { start, end: isoDate(date) };
  }
  throw new Error(localizeUI("Неизвестный период"));
}

export function shiftPeriodAnchor(anchor, period, amount) {
  const date = asUtcDate(anchor);
  if (!Number.isInteger(amount)) throw new Error(localizeUI("Некорректный шаг периода"));
  if (period === "week") {
    date.setUTCDate(date.getUTCDate() + amount * 7);
    return isoDate(date);
  }
  if (period === "month") {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + amount);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
    return isoDate(date);
  }
  throw new Error(localizeUI("Неизвестный период"));
}

export function summarizePeriod(days, start, end) {
  const rows = days
    .filter((day) => day.date >= start && day.date <= end)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  let eventCount = 0;
  let turnover = 0;
  const highlights = [];
  for (const day of rows) {
    for (const event of day.events) {
      if (event.deletedAt) continue;
      eventCount++;
      turnover += Math.abs(event.delta);
      const item = { ...event, date: day.date };
      let index = 0;
      while (index < highlights.length) {
        const current = highlights[index];
        const currentBefore =
          Math.abs(current.delta) > Math.abs(item.delta) ||
          (Math.abs(current.delta) === Math.abs(item.delta) &&
            (current.date < item.date ||
              (current.date === item.date &&
                (current.time ?? "") <= (item.time ?? ""))));
        if (!currentBefore) break;
        index++;
      }
      if (index < 3) {
        highlights.splice(index, 0, item);
        if (highlights.length > 3) highlights.pop();
      }
    }
  }
  const first = rows[0];
  const last = rows.at(-1);
  const delta = first && last ? round(last.close - first.open) : 0;
  const base = first?.open ?? 0;
  return {
    start,
    end,
    days: rows.length,
    eventCount,
    delta,
    percent: percentage(delta, base),
    turnover: round(turnover),
    highlights,
    notes: rows
      .filter((day) => day.title || day.note)
      .map(({ date, title, note }) => ({ date, title, note })),
  };
}
