// Visual gaps are closed excursions around the last recorded value. They never
// predict the next event or contribute to the journal's recorded result.
export function rhythmSeed(text) {
  let seed = 2166136261;
  for (const ch of String(text))
    seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  return seed;
}

export function rhythmAmplitude(impulse, count, strength = 4) {
  const weight = Math.max(0, Number.isFinite(strength) ? strength / 4 : 1);
  // The normal rhythm uses 1% of the last real impulse per empty candle.
  // Even the strongest setting cannot exceed half that impulse.
  return Math.abs(impulse) * Math.min(0.5, Math.max(0, count) * 0.01 * weight);
}

export function rhythmValue(base, impulse, start, end, time, interval, seed = 0, strength = 4) {
  if (time <= start || time >= end || end <= start || !impulse) return base;
  const count = Math.ceil((end - start) / interval);
  const amplitude = rhythmAmplitude(impulse, count, strength);
  const u = (time - start) / (end - start);
  const phase = (seed % 997) / 997 * Math.PI * 2;
  // A few broad market-like waves with smaller pullbacks, rather than a random
  // value per candle. Both the level and slope meet the real anchors smoothly.
  const cycles = Math.min(10, Math.max(1, Math.sqrt(count) / 1.5));
  const envelope = Math.sin(Math.PI * u) ** 2;
  const wave =
    0.62 * Math.sin(Math.PI * 2 * cycles * u + phase) +
    0.25 * Math.sin(Math.PI * 2 * cycles * 1.85 * u + phase * 0.7) +
    0.13 * Math.sin(Math.PI * 2 * cycles * 3.1 * u + phase * 1.3);
  const value = base + amplitude * envelope * wave;
  return base >= 0.01 ? Math.max(0.01, value) : value;
}

// `groups` contain complete recorded interval buckets, not interpolated events.
// Keeping the model at this level guarantees a +5% event always has its own
// actual before/after body even if its minute lies in a larger hourly bucket.
export function rhythmBars(groups, initial, interval, start, end, interpolate = true, strength = 4, horizon = end) {
  const out = [];
  let at = 0, upper = groups.length;
  while (at < upper) {
    const middle = (at + upper) >>> 1;
    if (groups[middle].stop <= start) at = middle + 1;
    else upper = middle;
  }
  let previous = groups[at - 1];
  for (let from = start; from < end; from += interval) {
    const to = Math.min(horizon, from + interval);
    const next = groups[at];
    if (next?.start === from) {
      out.push({ from, to, ...next });
      previous = next;
      at++;
      continue;
    }
    const base = previous?.close ?? initial;
    const gapStart = previous?.stop ?? start;
    const gapEnd = next?.start ?? horizon;
    const valueAt = (time) => interpolate
      ? rhythmValue(base, previous?.impulse ?? 0, gapStart, gapEnd, time,
          interval, previous?.seed ?? 0, strength)
      : base;
    const open = valueAt(from), close = valueAt(to);
    let high = Math.max(open, close), low = Math.min(open, close);
    // Sample within the bar so a single closed visual candle still has a wick.
    // The same bounded curve supplies bodies and extrema at every interval.
    for (let sample = 1; sample < 8; sample++) {
      const value = valueAt(from + (to - from) * sample / 8);
      high = Math.max(high, value);
      low = Math.min(low, value);
    }
    out.push({ from, to, open, close, high, low, events: [] });
  }
  return out;
}

export function recordedGroups(events, interval, horizon) {
  const groups = [];
  let impulse = 0;
  for (const event of events) {
    if (event.at >= horizon) break;
    const start = Math.floor(event.at / interval) * interval;
    let group = groups.at(-1);
    if (!group || group.start !== start) {
      group = {
        start, stop: Math.min(start + interval, horizon),
        open: event.before, close: event.after,
        high: Math.max(event.before, event.after),
        low: Math.min(event.before, event.after), events: [],
      };
      groups.push(group);
    }
    group.events.push(event.source ?? event);
    group.close = event.after;
    group.high = Math.max(group.high, event.before, event.after);
    group.low = Math.min(group.low, event.before, event.after);
    // A zero-weight note does not erase the last actual market impulse.
    if (event.delta) impulse = Math.abs(event.delta);
    group.impulse = impulse;
    group.seed = rhythmSeed(`${event.date ?? ''}|${event.time}|${event.id ?? ''}`);
  }
  return groups;
}
