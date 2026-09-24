import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const work = path.resolve(root, '../../work');
const exe = process.env.HIGH_TEST_EXE || process.env.VYSHE_TEST_EXE || path.join(root, 'src-tauri/target/release/high.exe');
const profile = await fs.mkdtemp(path.join(work, 'tauri-native-profile-'));
const shots = path.join(work, 'tauri-native-qa');
await fs.mkdir(shots, { recursive: true });
await fs.writeFile(path.join(profile, 'preferences.json'), JSON.stringify({ initialized: true, autoStart: true, tray: true, autoUpdates: false }));
const errors = [];
let child, browser, page;
async function launch(args = []) {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  child = spawn(exe, args, { env: { ...process.env, VYSHE_DATA_DIR: profile, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` }, windowsHide: true, stdio: 'pipe' });
  child.stderr.on('data', data => process.stderr.write(data));
  const deadline = Date.now() + 45000;
  let endpoint;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Native app exited ${child.exitCode}`);
    try { endpoint = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(endpoint, 'WebView2 debugging endpoint must start');
  browser = await chromium.connectOverCDP(endpoint.webSocketDebuggerUrl);
  const context = browser.contexts()[0];
  page = context.pages()[0] || await context.waitForEvent('page');
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => !!window.desktop);
  return page;
}
async function stop() {
  const exited = once(child, 'exit');
  await page.evaluate(() => window.desktop.close()).catch(error => {
    if (!/closed|destroyed/i.test(error.message)) throw error;
  });
  await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new Error('Native close did not finish')), 10000))]);
  await browser.close();
  browser = null; child = null;
}
const visible = () => page.evaluate(() => window.__TAURI__.window.getCurrentWindow().isVisible());
try {
  await launch();
  assert.equal(await visible(), true, 'manual launch opens full window even with tray preference');
  const appPreferences = await page.evaluate(() => window.desktop.preferences());
  assert.equal(appPreferences.portable, false, 'installed builds must expose the updater');
  const updateState = await page.evaluate(() => window.desktop.updateState());
  assert.equal(updateState.state, 'idle');
  assert.equal(updateState.version, '1.9.9.19');
  await page.locator('#start-form [type=submit]').click();
  await page.locator('#coin-form [type=submit]').click();
  await page.waitForSelector('dialog', { state: 'detached' });
  assert.equal(await page.title(), 'High. — личная траектория');
  assert.equal(await page.locator('.brand').innerText(), 'High.');
  const brandDotColors = await page.locator('.brand-dot').first().evaluate((dot) => {
    const sample = document.createElement('span');
    sample.style.color = 'var(--accent)';
    dot.after(sample);
    const expected = getComputedStyle(sample).color;
    sample.remove();
    return { actual: getComputedStyle(dot).color, expected };
  });
  assert.equal(brandDotColors.actual, brandDotColors.expected);
  assert.equal(await page.locator('.footer-version').innerText(), 'High. 1.9.9.19');
  await page.locator('#add-event').click();
  await page.locator('[name=text]').fill('Настоящий WebView2');
  await page.locator('[name=delta]').fill('8');
  await page.locator('#event-form [type=submit]').click();
  await page.waitForSelector('dialog', { state: 'detached' });
  const saved = await page.evaluate(async () => (await window.desktop.load()).journal);
  assert.equal(saved.events[0].text, 'Настоящий WebView2');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(profile, 'journal.json'), 'utf8')), saved);
  await page.locator('#settings').click();
  await page.locator('[data-settings-tab="data"]').click();
  assert.equal(await page.locator('#sync-connect').isVisible(), true);
  assert.equal(await page.locator('#sync-now').isDisabled(), true, 'sync stays off until a pairing file is chosen');
  const pairingFile = process.env.HIGH_SYNC_TEST_CREDENTIALS;
  if (pairingFile) {
    await page.locator('#sync-credentials-file').setInputFiles(pairingFile);
    await page.waitForFunction(() => document.querySelector('#sync-status')?.textContent.startsWith('Файл принят.'));
    assert.equal(await page.locator('#sync-now').isDisabled(), false, 'valid pairing file enables manual sync');
  }
  await page.locator('.modal-close').click();
  await page.waitForSelector('dialog', { state: 'detached' });
  await assert.rejects(page.evaluate(() => window.__TAURI__.core.invoke('profile_io', { op: 'read', file: '../preferences.json' })));
  await page.screenshot({ path: path.join(shots, 'real-webview2.png') });
  await stop();
  await launch(['--background']);
  assert.equal(await visible(), false, 'system autostart can start in tray');
  assert.deepEqual((await page.evaluate(async () => (await window.desktop.load()).journal)).events, saved.events);
  const second = spawn(exe, [], { env: { ...process.env, VYSHE_DATA_DIR: profile }, windowsHide: true });
  await once(second, 'exit');
  await page.waitForFunction(async () => window.__TAURI__.window.getCurrentWindow().isVisible());
  assert.equal(await visible(), true, 'manual second launch opens existing tray instance');
  assert.deepEqual(errors, []);
  await stop();
  console.log(JSON.stringify({ result: 'PASS', exe, profile, checks: ['real WebView2 rendering', 'create and save', 'restart persistence', 'scoped native IO', 'manual visible', 'autostart tray', 'second launch visible', 'graceful close'] }, null, 2));
} finally {
  if (child) child.kill();
  await browser?.close().catch(() => {});
}
