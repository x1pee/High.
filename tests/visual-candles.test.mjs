import test from 'node:test';
import assert from 'node:assert/strict';
import { visualCandle } from '../src/visual-candles.mjs';

test('display tails are deterministic and never mutate real or starter OHLC', () => {
  for (const flags of [{recorded:true}, {synthetic:true,starter:true}]) {
    const bar={date:'2026-10-08',time:'00:48',open:100,close:103,high:103,low:100,...flags};
    const before=structuredClone(bar), display=visualCandle(bar);
    assert(display.high>103 && display.low<100);
    assert.deepEqual(visualCandle(bar),display);
    assert.deepEqual(bar,before);
    assert.equal(display.close,bar.close);
  }
});
test('empty future and disabled visual rhythm do not invent extrema', () => {
  for(const flags of [{future:true,synthetic:true},{recorded:false,synthetic:false}]) {
    const bar={open:100,close:100,high:100,low:100,...flags};
    assert.equal(visualCandle(bar),bar);
  }
});

test('sampled visual gaps keep their impulse-bound extrema; tiny real events get proportionate tails', () => {
  const gap={date:'2026-10-21',time:'10:20',open:100,close:100.001,high:100.002,low:99.998,intraday:true,synthetic:true,recorded:false};
  const display=visualCandle(gap);
  assert.equal(display.high,gap.high);
  assert.equal(display.low,gap.low);
  const tiny=visualCandle({...gap,open:100,close:100.001,high:100.001,low:100,recorded:true});
  assert(tiny.high<100.002 && tiny.low>99.999);
});
