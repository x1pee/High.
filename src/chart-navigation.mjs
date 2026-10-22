// Navigation lives in fractional candle coordinates. Loading another history
// slice must never change the distance represented by one pointer pixel.
export function timeToLogical(minute, interval) {
  if (interval < 43200) return minute / interval;
  const date = new Date(minute * 60000);
  const year = date.getUTCFullYear(), month = date.getUTCMonth();
  const start = Date.UTC(year, month, 1) / 60000;
  const stop = Date.UTC(year, month + 1, 1) / 60000;
  const months = interval === 525600 ? 12 : interval === 129600 ? 3 : 1;
  return (year * 12 + month + (minute - start) / (stop - start)) / months;
}

export function logicalToTime(logical, interval) {
  if (interval < 43200) return logical * interval;
  const months = interval === 525600 ? 12 : interval === 129600 ? 3 : 1;
  const coordinate = logical * months;
  const whole = Math.floor(coordinate);
  const start = Date.UTC(Math.floor(whole / 12), whole % 12, 1) / 60000;
  const stop = Date.UTC(Math.floor(whole / 12), whole % 12 + 1, 1) / 60000;
  return start + (stop - start) * (coordinate - whole);
}

export function panLogicalRange(range, deltaPixels, plotWidth) {
  const shift = deltaPixels * (range.to - range.from) / plotWidth;
  return { from: range.from - shift, to: range.to - shift };
}

export function zoomLogicalRange(range, factor, anchorRatio = 0.5, minBars = 3, maxBars = 2400) {
  const ratio = Math.max(0, Math.min(1, anchorRatio));
  const oldSize = range.to - range.from;
  const size = Math.max(minBars, Math.min(maxBars, oldSize * factor));
  const anchor = range.from + oldSize * ratio;
  return { from: anchor - size * ratio, to: anchor + size * (1 - ratio) };
}

export function captureLogicalRange(firstCenter, firstX, left, width, spacing) {
  const from = firstCenter - (firstX - left) / spacing;
  return { from, to: from + width / spacing };
}
