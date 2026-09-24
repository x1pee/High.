import { round } from './domain.mjs';
import { eventVolume } from './chart-volume.mjs';
import { minuteAt } from './timeline.mjs';
import { shiftDate } from './domain.mjs';

export function visibleSummary(bars) {
  if (!bars.length) return { min: null, max: null, minutes: 0 };
  let min = Infinity, max = -Infinity;
  for (const bar of bars) {
    min = Math.min(min, bar.low);
    max = Math.max(max, bar.high);
  }
  const first = bars[0], last = bars.at(-1);
  const from = first.from ?? minuteAt(first.date);
  const to = last.to ?? minuteAt(shiftDate(last.endDate ?? last.date, 1));
  return { min, max, minutes: Math.max(0, to - from) };
}

export function rangePeriod(minutes) {
  if (!minutes) return 'видимый участок';
  const number = n => Number(n.toFixed(1)).toLocaleString('ru-RU');
  if (minutes < 60) return `${number(minutes)} мин`;
  if (minutes <= 72 * 60) return `${number(minutes / 60)} ч`;
  if (minutes % 43200 === 0) return `${number(minutes / 43200)} мес.`;
  return `${number(minutes / 1440)} дн.`;
}

// Sum absolute calculated changes in the exact bars shown by the chart.
export function visibleTurnover(bars) {
  return round(bars.reduce((sum, bar) => sum + eventVolume(bar.events), 0));
}
