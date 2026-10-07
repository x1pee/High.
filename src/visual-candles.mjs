// Presentation only: decorative extrema never enter events, totals or storage.
export function visualCandle(c) {
  if (c.future || (!c.recorded && !c.synthetic)) return c;
  let seed = 2166136261;
  for (const ch of `${c.date}|${c.time ?? ''}|${c.open}|${c.close}`)
    seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const body = Math.abs(c.close - c.open);
  const unit = Math.max(Math.abs(c.open), Math.abs(c.close), 0.01);
  const tail = Math.max(body * 0.16, unit * 0.0007);
  const upper = tail * (0.65 + (seed % 101) / 100);
  const lower = tail * (0.65 + ((seed >>> 8) % 101) / 100);
  return {
    ...c,
    high: Math.max(c.high, c.open, c.close) + upper,
    low: c.low >= 0.01
      ? Math.max(0.01, Math.min(c.low, c.open, c.close) - lower)
      : Math.min(c.low, c.open, c.close) - lower,
    decorativeExtrema: true,
  };
}
