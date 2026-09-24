import { round } from './domain.mjs';
// These values alone are used by turnover; visual transitions never enter data.
export const eventVolume = events => round(events.reduce((sum, event) => sum + (!event.deletedAt && Number.isFinite(event.delta) ? Math.abs(event.delta) : 0), 0));
export const volumeTone = (value, direction) =>
  direction < 0 ? "down" : direction > 0 || value === 0 ? "up" : "muted";
const noise = key => {
  let hash = 2166136261;
  for (const ch of key) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
};
export function chartVolume(bars, maxHeight = 70) {
  const values = bars.map(bar => eventVolume(bar.events));
  const peak = Math.max(0, ...values);
  // Real event bars use a linear scale so a 12% change is six times a 2% change.
  // Neighboring interpolation only fills empty candles and never inflates events.
  const impulses = values.map(value => peak ? (value / peak) * maxHeight * 0.68 : 0);
  return bars.map((bar, i) => {
    const key = `${bar.date ?? ''}:${bar.from ?? bar.time ?? ''}`;
    const jitter = noise(key);
    const floor = maxHeight * (0.045 + jitter * 0.065);
    let shoulder = 0;
    for (let distance = 1; distance <= 4; distance++) {
      const weight = [0, 0.62, 0.36, 0.18, 0.07][distance];
      shoulder = Math.max(shoulder,
        (impulses[i - distance] ?? 0) * weight * (0.75 + jitter * 0.25),
        (impulses[i + distance] ?? 0) * weight * (0.75 + jitter * 0.25));
    }
    const value = values[i], count = bar.events.filter(event => !event.deletedAt).length;
    return { count, value, height: value > 0 ? impulses[i] : Math.max(floor, shoulder), decorative: value === 0 };
  });
}
