import test from 'node:test';
import assert from 'node:assert/strict';
import { chartVolume, volumeTone } from '../src/chart-volume.mjs';
import { createJournal, upsertEvent, calculate } from '../src/domain.mjs';
const bars = counts => counts.map(count => ({ events: Array(count).fill({delta:1}), synthetic: !count }));
test('volume uses magnitude of all changes with percentage entries calculated at their actual base', () => {
  let journal = createJournal('Объём', 100);
  journal = upsertEvent(journal, { date: '2026-09-24', time: '10:00', text: 'up', delta: 10 });
  journal = upsertEvent(journal, { date: '2026-09-24', time: '11:00', text: 'down', delta: -5 });
  assert.equal(chartVolume(calculate(journal))[0].value, 15);
  journal = upsertEvent(journal, { date: '2026-09-24', time: '12:00', text: 'percent', delta: 10, unit: 'percent' });
  assert.equal(chartVolume(calculate(journal))[0].value, 25.5);
  assert.equal(chartVolume([{ events: [{delta:0}], synthetic:true }])[0].value, 0);
});
test('visual volume softens impulses with stable shoulders without fabricating turnover', () => {
  const input = Array.from({length: 15}, (_, i) => ({ date: '2026-09-24', time: `${i}:00`, events: i === 7 ? [{delta:1000}] : [], synthetic: i !== 7 }));
  const result = chartVolume(input);
  assert.deepEqual(result, chartVolume(input));
  assert.equal(result.reduce((sum, bar) => sum + bar.value, 0), 1000);
  assert.ok(result.every(bar => bar.height > 0 && bar.height <= 48));
  assert.ok(result[6].height > result[5].height && result[5].height > result[0].height);
  assert.ok(result[8].height > result[9].height && result[9].height > result[14].height);
  assert.ok(result[7].height > result[6].height);
  assert.ok(result[6].decorative && !result[7].decorative);
  const cropped = chartVolume(input.slice(2, 13));
  assert.equal(cropped[5].height, result[7].height);
  assert.equal(cropped[4].height, result[6].height);
});
test('volume magnitude depends on event size, not event count alone', () => {
  const result = chartVolume([
    { events: Array.from({ length: 6 }, () => ({ delta: 5 })) },
    { events: Array.from({ length: 6 }, () => ({ delta: 0.001 })) },
  ]);
  assert.equal(result[0].value, 30);
  assert.equal(result[1].value, 0.01);
  assert.ok(result[0].height > result[1].height * 1000);
});
test('decorative volume stays colorable even when the candle is flat', () => {
  assert.equal(volumeTone(0, 1), 'up');
  assert.equal(volumeTone(0, -1), 'down');
  assert.equal(volumeTone(0, 0), 'up');
  assert.equal(volumeTone(5, 0), 'muted');
  assert.equal(volumeTone(5, 1), 'up');
  assert.equal(volumeTone(5, -1), 'down');
});
