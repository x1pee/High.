import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createJournal, validateJournal } from '../src/domain.mjs';
import libraryModule from '../desktop/library.cjs';

test('a damaged expired trash snapshot cannot prevent opening a healthy journal', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'high-trash-audit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { GraphLibrary } = libraryModule;
  const library = new GraphLibrary(root, validateJournal);
  await library.init();
  const active = await library.create(createJournal('Keep this journal', 100));
  const removed = await library.create(createJournal('Deleted journal', 100));
  await library.remove(removed.id);
  const trashFile = path.join(root, 'deleted-graphs', path.basename(library.filename(removed.id)));
  const old = new Date(Date.now() - 31 * 86400000);
  for (const damaged of ['{truncated', 'null']) {
    await fs.writeFile(trashFile, damaged);
    await fs.utimes(trashFile, old, old);
    const restarted = new GraphLibrary(root, validateJournal);
    await restarted.init();
    assert.equal(restarted.current.id, active.id);
    assert.deepEqual(await restarted.trash(), []);
    assert.equal(await fs.readFile(trashFile, 'utf8'), damaged, 'keep damaged data for recovery');
    assert.ok(!(await restarted.list()).some(graph => graph.id === removed.id));
  }
});
