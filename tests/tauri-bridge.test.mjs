import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createJournal, upsertEvent } from '../src/domain.mjs';

execFileSync(process.execPath, ['scripts/build-tauri.mjs'], { cwd: path.resolve(import.meta.dirname, '..') });
// Tests the shipped browser bundle and its IPC argument contract. This is not
// a substitute for Rust tests or a real WebView2 run.
test('Tauri bridge preserves Electron journals, revisions, recovery and deleted graphs', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vyshe-tauri-bridge-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const calls = [];
  globalThis.document = { documentElement: { classList: { add() {} } }, querySelector: () => null, querySelectorAll: () => [] };
  globalThis.window = { __TAURI__: { event: { listen: async () => {} }, core: { invoke: async (command, args) => {
    if (command === 'ui_ready') return;
    if (command === 'preferences') return { platform: 'win32', portable: true };
    assert.equal(command, 'profile_io');
    calls.push(args);
    const file = path.join(root, args.file);
    assert.ok(file.startsWith(root + path.sep));
    switch (args.op) {
      case 'mkdir': return fs.mkdir(file, { recursive: true });
      case 'read': return fs.readFile(file, 'utf8');
      case 'write': return fs.writeFile(file, args.data);
      case 'list': return fs.readdir(file);
      case 'remove': return fs.unlink(file);
      case 'access': return fs.access(file);
      case 'copy': return fs.copyFile(file, path.join(root, args.target));
      case 'rename': return fs.rename(file, path.join(root, args.target));
      case 'stat': return (await fs.stat(file)).mtimeMs;
      default: throw new Error(`Unexpected operation ${args.op}`);
    }
  } } } };
  let generation = 0;
  const start = async () => {
    await import(`../tauri-dist/src/tauri-bridge.mjs?test=${++generation}`);
    return window.desktop;
  };
  let api = await start();
  assert.equal(api.updateState() instanceof Promise, true);
  const updateState = await api.updateState();
  assert.equal(updateState.version, "1.9.9.18");
  assert.ok(updateState.history.length >= 8);
  assert.equal(updateState.history[0].version, "1.9.9.18");
  assert.equal((await api.load()).journal, null);
  let original = await api.createGraph(createJournal());
  original = await api.save(upsertEvent(original, { date: '2026-09-24', time: '12:00', text: 'Проверка перехода', delta: 5 }), original.revision);
  await assert.rejects(api.save(original, 0), /изменились/);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'journal.json'), 'utf8')), original);
  const second = await api.createGraph(createJournal());
  const archive = createHash('sha256').update(original.id).digest('hex') + '.json';
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'graphs', archive), 'utf8')), original);
  await api.deleteGraph(original.id);
  assert.equal((await api.trash())[0].id, original.id);
  api = await start();
  assert.equal((await api.load()).journal.id, second.id);
  assert.equal((await api.graphs()).length, 1);
  const restored = await api.restoreGraph(original.id);
  assert.equal(restored.events[0].text, 'Проверка перехода');
  assert.equal((await api.trash()).length, 0);
  await fs.writeFile(path.join(root, 'journal.json'), 'damaged');
  api = await start();
  assert.match((await api.load()).notice, /восстановлены/);
  assert.ok((await fs.readdir(root)).some(name => name.startsWith('damaged-')));
  assert.ok(calls.some(call => call.op === 'rename' && call.target === 'journal.json'));
  delete globalThis.window;
  delete globalThis.document;
});
