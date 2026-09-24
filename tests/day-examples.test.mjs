import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_PROMPTS, nextDayPrompt } from '../src/day-examples.mjs';

test('day form cycles through 100 distinct prompts before repeating any', () => {
  assert.equal(DAY_PROMPTS.length, 100);
  assert.equal(new Set(DAY_PROMPTS).size, 100);
  const sequence = Array.from({ length: 100 }, nextDayPrompt);
  assert.equal(new Set(sequence).size, 100);
  assert(sequence.every((prompt) => DAY_PROMPTS.includes(prompt)));
  for (let i = 0; i < 200; i++) assert.ok(DAY_PROMPTS.includes(nextDayPrompt()));
});
