// Deterministic, isolated browser QA. No installed journal/profile is opened.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const work = path.resolve(root, '../../work');
const shots = path.join(work, 'high-motion-qa');
await fs.mkdir(shots, { recursive: true });
const profile = await fs.mkdtemp(path.join(work, 'high-motion-profile-'));
execFileSync(process.execPath, ['scripts/build-tauri.mjs'], { cwd: root });
const assetRoot = path.join(root, 'tauri-dist');
const server = http.createServer(async (request, response) => {
  try {
    const file = path.resolve(assetRoot, '.' + new URL(request.url, 'http://local').pathname);
    if (!file.startsWith(assetRoot + path.sep)) throw Error('Invalid asset path');
    response.setHeader('Content-Type', { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream');
    response.end(await fs.readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { frames: [], navigation: [], errors: [], fixture: {} };
let browser;

async function saveContactSheet(files, output) {
  const width = 640, height = 360;
  const tiles = await Promise.all(files.map(async (file, index) => ({
    input: await sharp(file).resize(width, height, { fit: 'contain', background: '#101114' }).png().toBuffer(),
    left: index % 2 * width, top: Math.floor(index / 2) * height,
  })));
  await sharp({ create: { width: width * 2, height: height * Math.ceil(files.length / 2), channels: 4, background: '#101114' } }).composite(tiles).png().toFile(output);
}

try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, timezoneId: 'Europe/Moscow' });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.exposeBinding('nativeInvoke', async (_, command, args = {}) => {
    if (command === 'ui_ready') return;
    if (command === 'preferences') return { initialized: true, autoStart: false, tray: false, portable: true, platform: 'win32', autoUpdates: false };
    if (command !== 'profile_io') throw Error(`Unexpected command: ${command}`);
    const file = path.join(profile, args.file);
    switch (args.op) {
      case 'mkdir': return fs.mkdir(file, { recursive: true });
      case 'read': return fs.readFile(file, 'utf8');
      case 'write': return fs.writeFile(file, args.data);
      case 'list': return fs.readdir(file);
      case 'remove': return fs.unlink(file);
      case 'access': return fs.access(file);
      case 'copy': return fs.copyFile(file, path.join(profile, args.target));
      case 'rename': return fs.rename(file, path.join(profile, args.target));
      case 'stat': return (await fs.stat(file)).mtimeMs;
      default: throw Error(`Unexpected profile operation: ${args.op}`);
    }
  });
  await page.addInitScript(() => {
    const RealDate = Date;
    const fixed = RealDate.parse('2026-10-22T18:00:00+03:00');
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    };
    window.__TAURI__ = { core: { invoke: async (command, args) => {
      try { return await window.nativeInvoke(command, args); }
      catch (error) { throw { message: error.message, code: error.message.includes('ENOENT') ? 'ENOENT' : 'EIO' }; }
    } }, event: { listen: async () => () => {} } };
    // Retain and pause real animations at creation, including the first frame.
    // Advancing currentTime gives repeatable screenshots independent of CPU load.
    window.__motionAnimations = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const result = animate.apply(this, args);
      if (this.closest?.('[data-event-impulse]') || this.hasAttribute?.('data-event-impulse') || this.hasAttribute?.('data-event-halo')) {
        result.pause(); result.currentTime = 0;
        window.__motionAnimations.push({ result, target: this });
      }
      return result;
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => !!window.desktop);
  report.fixture = await page.evaluate(async () => {
    const { createJournal, upsertEvent, calculate } = await import('/src/domain.mjs');
    let journal = createJournal('MOTIONUSDT', 100, 'dark');
    Object.assign(journal.settings, { liveChart: false, eventAnimation: true, reducedMotion: false, followEvent: true, rhythmStrength: 4, chartDensity: 45 });
    journal = await window.desktop.createGraph(journal);
    const revision = journal.revision;
    journal = upsertEvent(journal, { date: '2026-10-20', time: '09:00', delta: 10, unit: 'percent', text: 'First real impulse +10%' });
    journal = upsertEvent(journal, { date: '2026-10-21', time: '21:00', delta: -2, unit: 'percent', text: 'Second real impulse -2%' });
    journal = await window.desktop.save(journal, revision);
    return { id: journal.id, eventCount: journal.events.length, value: calculate(journal).at(-1).close };
  });
  assert.equal(report.fixture.value, 107.8);
  await page.reload();
  await page.waitForSelector('#chart .chart-candle');
  await page.locator('[data-interval="60"]').click();
  assert.ok(await page.locator('.chart-candle[data-synthetic="true"]').count() >= 10, 'fixture must include a multi-day visual bridge');
  await page.screenshot({ path: path.join(shots, '00-before-event.png') });

  async function captureEvent(name, delta, time, expectedBefore, expectedAfter, intervalOpen = expectedBefore) {
    await page.evaluate(() => { window.__motionAnimations.length = 0; });
    await page.locator('#add-event').click();
    await page.locator('#event-form [name="text"]').fill(name);
    await page.locator('#event-form [data-unit="percent"]').click();
    await page.locator('#event-form [name="delta"]').fill(String(delta));
    await page.locator('[data-event-time="custom"]').click();
    const [hour, minute = '00'] = time.split(':');
    await page.locator(`#event-form [data-time-hour="${hour}"]`).click();
    await page.locator(`#event-form [data-time-minute="${minute}"]`).click();
    await page.locator('#event-form [type="submit"]').click();
    await page.waitForSelector('#chart[data-event-animation="playing"] [data-event-impulse]', { state: 'attached' });
    const files = [];
    const origin = await page.locator('[data-event-impulse]').evaluate(element => {
      const animatedVisuals = document.getAnimations().filter(animation => animation.effect?.target?.matches?.('.chart-candle[data-synthetic="true"]'));
      return { dataset: { ...element.dataset }, animatedVisuals: animatedVisuals.length };
    });
    assert.equal(origin.animatedVisuals, 0, 'previous visual candles must not replay or grow one by one');
    for (const ms of [0, 50, 100, 200, 400, 700]) {
      const frame = await page.evaluate(async ms => {
        for (const { result } of window.__motionAnimations) result.currentTime = ms;
        await new Promise(requestAnimationFrame);
        const impulse = document.querySelector('[data-event-impulse]');
        const body = impulse?.querySelector('rect');
        const scale = impulse ? new DOMMatrixReadOnly(getComputedStyle(impulse).transform).d : null;
        const before = Number(impulse?.dataset.before), after = Number(impulse?.dataset.after);
        return {
          ms, dataset: impulse ? { ...impulse.dataset } : null,
          body: body ? Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, +body.getAttribute(key)])) : null,
          transform: impulse ? getComputedStyle(impulse).transform : null,
          currentValue: before + (after - before) * scale,
          syntheticTransforms: [...document.querySelectorAll('.chart-candle[data-synthetic="true"]')].map(el => getComputedStyle(el).transform),
        };
      }, ms);
      assert.ok(frame.dataset, `${name}: impulse must exist at ${ms}ms`);
      assert.ok(frame.syntheticTransforms.every(value => value === 'none'), `${name}: visual history must remain stable at ${ms}ms`);
      const value = frame.currentValue;
      assert.equal(Number(frame.dataset.before), intervalOpen, `${name}: the interval opening must match real observations`);
      assert.equal(Number(frame.dataset.initialValue), expectedBefore, `${name}: animation starts from the previous current value`);
      assert.equal(Number(frame.dataset.after), expectedAfter, `${name}: the impulse must end at the recorded value`);
      assert.ok(value >= Math.min(expectedBefore, expectedAfter) - 0.001 && value <= Math.max(expectedBefore, expectedAfter) + 0.001, `${name}: animation cannot overshoot real endpoints (${value})`);
      if (ms === 0) assert.ok(Math.abs(value - expectedBefore) < .0001, `${name}: first frame must start at the previous current value`);
      if (ms >= Number(frame.dataset.duration)) assert.ok(Math.abs(value - expectedAfter) < .0001, `${name}: final frames must end exactly at the real closing`);
      report.frames.push({ name, ...frame });
      const file = path.join(shots, `${name}-${String(ms).padStart(3, '0')}ms.png`);
      await page.locator('#chart').screenshot({ path: file, animations: 'allow' });
      files.push(file);
    }
    await saveContactSheet(files, path.join(shots, `${name}-contact-sheet.png`));
    await page.evaluate(() => { for (const { result } of window.__motionAnimations) { try { result.finish(); } catch {} } });
    await page.waitForFunction(() => !document.querySelector('#chart')?.dataset.eventAnimation);
    const actual = await page.evaluate(async () => {
      const { calculate } = await import('/src/domain.mjs');
      return calculate((await window.desktop.load()).journal).at(-1).events.at(-1);
    });
    assert.equal(actual.before, expectedBefore);
    assert.equal(actual.after, expectedAfter);
    assert.equal(actual.percent, delta);
    return actual;
  }
  await captureEvent('gain-five-percent', 5, '16', 107.8, 113.19);
  await captureEvent('loss-five-percent', -5, '17', 113.19, 107.53);
  await captureEvent('same-hour-recovery-five-percent', 5, '17:30', 107.53, 112.91, 113.19);

  async function latestValue() {
    return page.evaluate(async () => {
      const { calculate } = await import('/src/domain.mjs');
      return calculate((await window.desktop.load()).journal).at(-1).close;
    });
  }
  // Alternating quick clicks share one interval. They must start from the
  // previous current value even when the opposite direction creates a group.
  for (const [index, move] of ['up', 'up', 'down'].entries()) {
    const before = await latestValue();
    await page.evaluate(() => { window.__motionAnimations.length = 0; });
    await page.locator(`#quick-move-${move}`).click();
    await page.waitForSelector('#chart[data-event-animation="playing"] [data-event-impulse]', { state: 'attached' });
    const after = await latestValue();
    const files = [];
    for (const ms of [0, 50, 100, 200, 400, 700]) {
      const frame = await page.evaluate(async ms => {
        for (const { result } of window.__motionAnimations) result.currentTime = ms;
        await new Promise(requestAnimationFrame);
        const impulse = document.querySelector('[data-event-impulse]');
        const scale = new DOMMatrixReadOnly(getComputedStyle(impulse).transform).d;
        return { ms, dataset: { ...impulse.dataset }, currentValue: Number(impulse.dataset.before) + (Number(impulse.dataset.after) - Number(impulse.dataset.before)) * scale };
      }, ms);
      assert.ok(frame.currentValue >= Math.min(before, after) - .0001 && frame.currentValue <= Math.max(before, after) + .0001, `quick ${move}: no replay of the entire interval or endpoint overshoot at ${ms}ms (${frame.currentValue}, expected ${before}..${after})`);
      if (!ms) assert.ok(Math.abs(frame.currentValue - before) < .0001, `quick ${move}: start exactly from previous current value`);
      report.frames.push({ name: `quick-${index}-${move}`, ...frame });
      const file = path.join(shots, `quick-${index}-${move}-${String(ms).padStart(3, '0')}ms.png`);
      await page.locator('#chart').screenshot({ path: file, animations: 'allow' });
      files.push(file);
    }
    await saveContactSheet(files, path.join(shots, `quick-${index}-${move}-contact-sheet.png`));
    await page.evaluate(() => { for (const { result } of window.__motionAnimations) { try { result.finish(); } catch {} } });
    await page.waitForFunction(() => !document.querySelector('#chart')?.dataset.eventAnimation);
  }

  // Mouse gestures are measured in physical CSS pixels, not candle counts.
  const bounds = await page.locator('#chart').boundingBox();
  const point = { x: bounds.x + bounds.width * .42, y: bounds.y + bounds.height * .35 };
  const realCandle = page.locator('.chart-candle[data-recorded="true"]').last();
  const center = async () => realCandle.evaluate(element => {
    const rect = element.querySelector('.candle-body').getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  async function drag(dx, dy) {
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.x + dx, point.y + dy, { steps: 5 });
    await page.mouse.up(); await page.waitForTimeout(80);
  }
  if (await page.locator('#chart').getAttribute('data-scale') !== 'auto') await page.locator('#auto-range').click();
  const autoBefore = await center(); await drag(0, 35); const autoAfter = await center();
  assert.ok(Math.abs(autoBefore.y - autoAfter.y) < 1, 'Auto locks the vertical axis during dragging');
  report.navigation.push({ type: 'auto-vertical-lock', before: autoBefore, after: autoAfter });
  await page.locator('#auto-range').click();
  const manualBefore = await center(); await drag(0, 35); const manualAfter = await center();
  assert.ok(Math.abs(manualAfter.y - manualBefore.y - 35) < 1.5, 'manual vertical panning tracks cursor pixels');
  report.navigation.push({ type: 'manual-vertical-pan', before: manualBefore, after: manualAfter });
  const xBefore = await center(); await drag(-11, 0); const xAfter = await center();
  assert.ok(Math.abs(xAfter.x - xBefore.x + 11) < 1.5, 'horizontal panning must be continuous, without whole-candle jumps');
  report.navigation.push({ type: 'fractional-horizontal-pan', before: xBefore, after: xAfter });
  const anchorBefore = await center();
  await page.mouse.move(anchorBefore.x, point.y);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(100);
  const anchorAfter = await center();
  assert.ok(Math.abs(anchorAfter.x - anchorBefore.x) < 1, 'wheel zoom must preserve the time under the pointer');
  report.navigation.push({ type: 'wheel-zoom-pointer-anchor', before: anchorBefore, after: anchorAfter });
  await page.screenshot({ path: path.join(shots, '99-after-gestures.png') });
  assert.deepEqual(report.errors, [], 'no browser exceptions');
  report.passed = true;
  console.log(`Motion QA passed; frame captures: ${shots}`);
} finally {
  await fs.writeFile(path.join(shots, 'report.json'), JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
