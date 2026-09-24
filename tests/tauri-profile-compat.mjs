import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { validateJournal } from '../src/domain.mjs';
const root = path.resolve(import.meta.dirname, '..');
const source = path.join(process.env.APPDATA, 'Vyshe');
const work = path.resolve(root, '../../work');
const backup = await fs.mkdtemp(path.join(work, 'profile-before-tauri-1995-'));
const copy = await fs.mkdtemp(path.join(work, 'tauri-existing-profile-'));
const manifest = [];
const hash = data => createHash('sha256').update(data).digest('hex');
async function snapshot(relative = '') {
  for (const entry of await fs.readdir(path.join(source, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isDirectory() && ['graphs', 'backups', 'deleted-graphs'].includes(entry.name)) await snapshot(name);
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      const data = await fs.readFile(path.join(source, name));
      for (const dir of [backup, copy]) {
        await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true });
        await fs.writeFile(path.join(dir, name), data);
      }
      manifest.push({ file: name, sha256: hash(data) });
    }
  }
}
await snapshot();
await fs.writeFile(path.join(backup, 'manifest.json'), JSON.stringify(manifest, null, 2));
const original = await fs.readFile(path.join(source, 'journal.json'));
const expected = validateJournal(JSON.parse(original));
const child = spawn(path.join(root, 'src-tauri/target/release/high.exe'), [], { windowsHide: true,
  env: { ...process.env, VYSHE_DATA_DIR: copy, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9437' } });
let browser;
try {
  let endpoint;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { endpoint = await (await fetch('http://127.0.0.1:9437/json/version')).json(); break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!endpoint) throw new Error('WebView2 did not start');
  browser = await chromium.connectOverCDP(endpoint.webSocketDebuggerUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.waitForEvent('page');
  await page.waitForFunction(() => !!window.desktop);
  const result = await page.evaluate(async () => ({ load: await window.desktop.load(), graphs: await window.desktop.graphs(), trash: await window.desktop.trash() }));
  if (JSON.stringify(result.load.journal) !== JSON.stringify(expected)) throw new Error('Existing journal differs');
  if (result.load.blocked || result.load.notice) throw new Error('Unexpected recovery');
  if (hash(await fs.readFile(path.join(copy, 'journal.json'))) !== hash(original)) throw new Error('Startup changed journal bytes');
  const exit = once(child, 'exit');
  await page.evaluate(() => window.desktop.close()).catch(e => { if (!/closed|destroyed/i.test(e.message)) throw e; });
  await exit;
  for (const item of manifest) {
    if (hash(await fs.readFile(path.join(source, item.file))) !== item.sha256) throw new Error('Working profile changed');
  }
  const report = { result: 'PASS', backup, files: manifest.length, graphs: result.graphs.length, archived: result.trash.length, events: expected.events.length, originalUnchanged: true };
  await fs.writeFile(path.join(work, 'tauri-profile-compat-result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (child.exitCode === null) child.kill();
  await browser?.close().catch(() => {});
}
