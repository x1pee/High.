export const CHART_STYLES = [
  [
    "candles",
    "Обычные свечи",
    "Тело показывает начало и итог, тонкая тень — крайние значения.",
  ],
  [
    "hollow",
    "Полые свечи",
    "Рост от начала свечи — пустое тело, спад — закрашенное. Цвет сравнивает итог с предыдущей свечой.",
  ],
  [
    "heikin",
    "Heikin Ashi",
    "Сглаженные свечи помогают увидеть направление. В карточках остаются реальные значения записей.",
  ],
  [
    "bars",
    "Бары OHLC",
    "Вертикаль — минимум и максимум; засечка слева — начало, справа — итог.",
  ],
  [
    "baseline",
    "Базовая линия",
    "Зелёная область выше опоры, красная — ниже. Уровень настраивается в Дневнике.",
  ],
  ["line", "Линия", "Соединяет итоговые значения соседних свечей."],
];

export function heikinAshi(bars) {
  let previous = null;
  return bars.map((c) => {
    // No fabricated trends across a day without observations.
    if (!c.recorded && !c.synthetic) {
      previous = null;
      return { ...c };
    }
    const close = (c.open + c.high + c.low + c.close) / 4;
    const open = previous
      ? (previous.open + previous.close) / 2
      : (c.open + c.close) / 2;
    const result = {
      ...c,
      open,
      close,
      high: Math.max(c.high, open, close),
      low: Math.min(c.low, open, close),
    };
    previous = result;
    return result;
  });
}

export function segmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1,
    length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length))
    : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Pixels, not an entire time column: body + wick with a small forgiving margin.
export function hitCandle(
  bars,
  geometry,
  style,
  px,
  py,
  tolerance = 5,
  includeGaps = false,
) {
  if (
    !geometry ||
    px < geometry.left ||
    px > geometry.width - geometry.right ||
    py < geometry.top ||
    py > geometry.height - geometry.bottom
  )
    return null;
  const { x, y, bw, step, left } = geometry;
  const center = Math.floor((px - (geometry.candleLeft ?? left)) / step);
  const reach = Math.ceil((bw / 2 + tolerance + 4) / step) + 1;
  let nearest = null,
    distance = Infinity;
  for (
    let i = Math.max(0, center - reach);
    i <= Math.min(bars.length - 1, center + reach);
    i++
  ) {
    const c = bars[i];
    if (!c.recorded && !c.synthetic && !(includeGaps && c.intraday)) continue;
    const xx = x(i),
      open = y(c.open),
      close = y(c.close);
    const targetTolerance =
      tolerance + (Math.abs(open - close) <= 4 || bw <= 3 ? 4 : 1);
    let d;
    if (["line", "baseline"].includes(style)) {
      d = Math.hypot(px - xx, py - close);
      const next = bars[i + 1];
      if (next && (next.recorded || next.synthetic)) {
        const lineDistance = segmentDistance(
          px,
          py,
          xx,
          close,
          x(i + 1),
          y(next.close),
        );
        if (lineDistance <= tolerance && lineDistance < distance) {
          distance = lineDistance;
          nearest = Math.abs(px - xx) <= Math.abs(px - x(i + 1)) ? i : i + 1;
        }
      }
    } else {
      d = segmentDistance(px, py, xx, y(c.high), xx, y(c.low));
      if (style === "bars") {
        d = Math.min(
          d,
          segmentDistance(px, py, xx - bw / 2, open, xx, open),
          segmentDistance(px, py, xx, close, xx + bw / 2, close),
        );
      } else {
        const top = Math.min(open, close),
          bottom = top + Math.max(2, Math.abs(open - close));
        d = Math.min(
          d,
          Math.hypot(
            Math.max(Math.abs(px - xx) - bw / 2, 0),
            Math.max(top - py, py - bottom, 0),
          ),
        );
      }
    }
    if (d <= targetTolerance && d < distance) {
      nearest = i;
      distance = d;
    }
  }
  return nearest;
}

// Fit actual visible prices; distant overlays must not flatten candles.
export function candlePriceRange(bars) {
  const values = bars.flatMap((c) => [c.low, c.high]).filter(Number.isFinite);
  if (!values.length) return { low: -1, high: 1 };
  const low = Math.min(...values),
    high = Math.max(...values);
  const span = high - low;
  const pad =
    span > 0
      ? Math.max(span * 0.065, 0.005)
      : Math.max(Math.abs(high) * 0.005, 1);
  return { low: low - pad, high: high + pad };
}

export function shiftPriceRange(range, deltaPixels, plotHeight) {
  if (
    !range ||
    !Number.isFinite(range.low) ||
    !Number.isFinite(range.high) ||
    !Number.isFinite(deltaPixels) ||
    !Number.isFinite(plotHeight) ||
    plotHeight <= 0
  )
    return range;
  const shift = ((range.high - range.low) * deltaPixels) / plotHeight;
  return { low: range.low + shift, high: range.high + shift };
}

export function scalePriceRange(range, factor, anchorRatio = 0.5) {
  if (
    !range ||
    !Number.isFinite(range.low) ||
    !Number.isFinite(range.high) ||
    range.high <= range.low ||
    !Number.isFinite(factor) ||
    factor <= 0 ||
    !Number.isFinite(anchorRatio)
  )
    return range;
  const ratio = Math.max(0, Math.min(1, anchorRatio));
  const oldSpan = range.high - range.low;
  const nextSpan = oldSpan * Math.max(0.05, Math.min(20, factor));
  const anchorValue = range.high - oldSpan * ratio;
  const high = anchorValue + nextSpan * ratio;
  return { low: high - nextSpan, high };
}

export function chartIndexAtTime(times, time, fallbackStep = 1) {
  if (!times?.length || !Number.isFinite(time)) return 0;
  if (times.length === 1) {
    const step = Number.isFinite(fallbackStep) && fallbackStep > 0 ? fallbackStep : 1;
    return (time - times[0]) / step;
  }
  const last = times.length - 1;
  if (time <= times[0]) {
    const step = times[1] - times[0] || fallbackStep || 1;
    return (time - times[0]) / step;
  }
  if (time >= times[last]) {
    const step = times[last] - times[last - 1] || fallbackStep || 1;
    return last + (time - times[last]) / step;
  }
  const upper = times.findIndex((value) => value >= time);
  const lower = upper - 1;
  const span = times[upper] - times[lower];
  return lower + (span ? (time - times[lower]) / span : 0);
}

export function chartTimeAtIndex(times, index, fallbackStep = 1) {
  if (!times?.length || !Number.isFinite(index)) return null;
  if (times.length === 1) {
    const step = Number.isFinite(fallbackStep) && fallbackStep > 0 ? fallbackStep : 1;
    return times[0] + index * step;
  }
  const last = times.length - 1;
  if (index <= 0) {
    const step = times[1] - times[0] || fallbackStep || 1;
    return times[0] + index * step;
  }
  if (index >= last) {
    const step = times[last] - times[last - 1] || fallbackStep || 1;
    return times[last] + (index - last) * step;
  }
  const lower = Math.floor(index);
  const fraction = index - lower;
  return times[lower] + (times[lower + 1] - times[lower]) * fraction;
}
