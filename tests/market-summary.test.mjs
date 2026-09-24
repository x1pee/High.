import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleSummary, rangePeriod, visibleTurnover } from '../src/market-summary.mjs';
test('extrema and period follow the selected candles, including wicks', () => {
  const bars = [{ from: 0, to: 60, low: 80, high: 130 }, { from: 60, to: 72 * 60, low: 90, high: 120 }];
  assert.deepEqual(visibleSummary(bars), { min: 80, max: 130, minutes: 4320 });
  assert.equal(rangePeriod(visibleSummary(bars).minutes), '72 ч');
  assert.equal(visibleSummary(bars.slice(1)).max, 120);
  assert.equal(rangePeriod(43200), '1 мес.');
  assert.deepEqual(visibleSummary([]), { min: null, max: null, minutes: 0 });
  assert.deepEqual(visibleSummary([{ date: '2026-09-01', endDate: '2026-09-30', low: 5, high: 20 }]), { min: 5, max: 20, minutes: 43200 });
});
test('turnover sums absolute changes only in visible bars', () => {
  const bars = [
    {events:[{delta:100},{delta:-50},{delta:0}]},
    {events:[],synthetic:true},
    {events:[{delta:10,deletedAt:'deleted'},{delta:0.01}]},
  ];
  assert.equal(visibleTurnover(bars), 150.01);
  assert.equal(visibleTurnover(bars.slice(1)), 0.01);
  assert.equal(visibleTurnover([]), 0);
});
