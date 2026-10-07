import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const work = path.resolve(root, '../../work');
const profile = await fs.mkdtemp(path.join(work, 'tauri-ui-profile-'));
const shots = path.join(work, 'tauri-ui-qa');
await fs.mkdir(shots, { recursive: true });
execFileSync(process.execPath, ['scripts/build-tauri.mjs'], { cwd: root });
const server = http.createServer(async (req, res) => {
  try {
    const file = path.resolve(root, 'tauri-dist', '.' + new URL(req.url, 'http://local').pathname);
    if (!file.startsWith(path.join(root, 'tauri-dist') + path.sep)) throw new Error('Invalid path');
    const type = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
    res.setHeader('Content-Type', type);
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 } });
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.exposeBinding('nativeInvoke', async (_, command, args = {}) => {
      if (command === 'ui_ready') return;
      if (command === 'preferences') return { initialized: true, autoStart: false, tray: false, portable: !mobile, platform: mobile ? 'mobile' : 'win32' };
      if (command !== 'profile_io') throw new Error(`Unexpected ${command}`);
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
      }
    });
    // Pass structured errors across the browser binding, just like Rust IPC.
    await page.addInitScript(() => {
      window.__TAURI__ = { core: { invoke: async (command, args) => {
        try { return await window.nativeInvoke(command, args); }
        catch (e) { throw { message: e.message, code: e.message.includes('ENOENT') ? 'ENOENT' : 'EIO' }; }
      } }, event: { listen: async () => {} } };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    if (!mobile) {
      await page.waitForSelector('.privacy-note');
      const onboarding = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
        privacyBottom: document.querySelector('.privacy-note')?.getBoundingClientRect().bottom,
      }));
      assert.ok(
        onboarding.privacyBottom <= onboarding.viewportHeight + 1,
        `first-run notes should fit without scrolling: ${JSON.stringify(onboarding)}`,
      );
      await page.locator('[data-preset=terminal]').click();
      await page.locator('#start-form [type=submit]').click();
      await page.waitForSelector('#coin-form');
      await page.locator('#coin-form [data-coin-custom]').click();
      assert.equal(await page.locator('#coin-form input[type=color]').count(), 0);
      await page.locator('#coin-form [name=coinHue]').evaluate((input) => {
        input.value = '190';
        input.dispatchEvent(new Event('input', {bubbles:true}));
      });
      const customHex = page.locator('#coin-form [name=coinHex]');
      assert.match(await customHex.inputValue(), /^#[a-f0-9]{6}$/);
      await page.screenshot({path:path.join(shots, 'coin-color-picker.png'), fullPage:true});
      await customHex.fill('#ff7799');
      assert.equal(
        await page.locator('#coin-form .coin-preview circle').first().getAttribute('stroke'),
        '#ff7799',
      );
      await page.locator('#coin-form [type=submit]').click();
      await page.waitForSelector('dialog', { state: 'detached' });
      assert.equal(await page.locator('.activity-heading #starter-banner').count(), 1);
      await page.screenshot({path: path.join(shots, 'starter.png'), fullPage:true});
      await page.locator('#updates').click();
      await page.waitForSelector('#release-history .release-row');
      assert.equal(await page.locator('[data-current-version]').innerText(), 'High. 2.0.0.1');
      assert.ok(await page.locator('#release-history .release-row').count() >= 8);
      assert.equal(await page.locator('#release-history .release-row').first().locator('b').innerText(), '2.0.0.1');
      assert.equal(await page.locator('#release-history .release-row').nth(1).locator('b').innerText(), '2.0.0');
      await page.locator('dialog[open]').screenshot({path:path.join(shots, 'release-history.png')});
      await page.locator('dialog[open] .modal-close').click();
      await page.locator('#settings').click();
      assert.equal(await page.locator('[data-settings-tab]').last().innerText(), 'Эксперименты');
      await page.locator('[data-settings-tab="experimental"]').click();
      const randomToggle = page.locator('#settings-form [name="experimentalRandom"]');
      assert.equal(await randomToggle.isChecked(), false);
      assert.equal(await page.locator('#random-event').count(), 0);
      await randomToggle.check();
      await page.locator('#settings-form .settings-save [type="submit"]').click();
      await page.waitForSelector('dialog', { state: 'detached' });
      assert.equal(await page.locator('#random-event').isVisible(), true);
      await page.setViewportSize({ width: 1000, height: 744 });
      await page.locator('#add-event').click();
      const amountInput = page.locator('#event-form [name="delta"]');
      await amountInput.fill('');
      await page.keyboard.type('1.5Рост рынка');
      assert.equal(await amountInput.inputValue(), '1.5');
      assert.equal(await page.locator('#event-form [name="text"]').inputValue(), 'Рост рынка');
      await page.locator('[data-event-time="custom"]').click();
      const previewBounds = await page.locator('#impact-preview').boundingBox();
      assert.ok(
        previewBounds && previewBounds.y >= 0 && previewBounds.y + previewBounds.height < 744,
        `event result should stay visible without scrolling: ${JSON.stringify(previewBounds)}`,
      );
      await page.screenshot({ path: path.join(shots, 'event-result-visible.png') });
      assert.equal(await page.locator('.time-picker input[type="time"]').count(), 0);
      await page.locator('[data-time-hour="04"]').click();
      await page.locator('[name="pickMinute"]').evaluate((input) => {
        input.value = '26';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      assert.equal(await page.locator('#event-form [name="time"]').inputValue(), '04:26');
      await page.locator('[data-time-minute="30"]').click();
      assert.equal(await page.locator('#event-form [name="time"]').inputValue(), '04:30');
      await page.locator('.time-picker').screenshot({path:path.join(shots, 'time-picker.png')});
      await page.locator('dialog[open] .modal-close').click();
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.locator('#add-event').click();
      await page.locator('[name=text]').fill('Проверка нового движка');
      await page.locator('[name=delta]').fill('');
      await page.locator('[name=delta]').pressSequentially('-0.2');
      assert.equal(await page.locator('[name=delta]').inputValue(), '-0.2');
      assert.equal(await page.locator('[data-delta-sign="-1"]').getAttribute('aria-pressed'), 'true');
      await page.locator('[name=delta]').fill('0');
      await page.locator('[data-delta-sign="-1"]').click();
      await page.locator('[name=delta]').press('End');
      await page.locator('[name=delta]').pressSequentially('.2');
      assert.equal(await page.locator('[name=delta]').inputValue(), '-0.2');
      await page.locator('[name=delta]').fill('7');
      await page.locator('#event-form [type=submit]').click();
      await page.waitForSelector('dialog', { state: 'detached' });
      const valueBeforeQuickMove = await page.locator('.main-value').textContent();
      await page.locator('#quick-move-up').click();
      await page.waitForFunction(() => document.querySelector('.main-value .number-roll-track'));
      assert.match(
        await page.locator('.main-value .number-roll-track').getAttribute('class'),
        /roll-up/,
      );
      await page.screenshot({ path: path.join(shots, 'quick-move-roll-up.png') });
      await page.waitForFunction(() => !document.querySelector('.main-value .number-roll-track'));
      assert.notEqual(await page.locator('.main-value').textContent(), valueBeforeQuickMove);
      await page.locator('#quick-move-down').click();
      await page.waitForFunction(() => document.querySelector('.main-value .number-roll-track'));
      assert.match(
        await page.locator('.main-value .number-roll-track').getAttribute('class'),
        /roll-down/,
      );
      await page.screenshot({ path: path.join(shots, 'quick-move-roll-down.png') });
      const signedRolls = await page.locator('#day-panel .number-roll-track > span').evaluateAll(nodes => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--up)';
        document.body.append(probe);
        const up = getComputedStyle(probe).color;
        probe.remove();
        return nodes.map(n => ({text:n.textContent,color:getComputedStyle(n).color,up}));
      });
      assert.ok(signedRolls.some(n => n.text.startsWith('+')), 'fixture must still have a positive day after the down move');
      assert.ok(signedRolls.filter(n => n.text.startsWith('+')).every(n => n.color === n.up), 'positive totals must stay green during a down animation');
      await page.waitForFunction(() => !document.querySelector('.main-value .number-roll-track'));
      await page.evaluate(async () => {
        const { upsertEvent, upsertDay, localDate, shiftDate } = await import('/src/domain.mjs');
        let journal = (await window.desktop.load()).journal;
        const revision = journal.revision;
        delete journal.settings.starter;
        for (const [day, count] of [1,2,1,3,9,3,1,5,2,12,3,4].entries()) {
          if (day !== 5) for (let i = 0; i < count; i++) journal = upsertEvent(journal, {
              date: shiftDate(localDate(), -day), time: '00:00',
              text: 'Проверка объёма', delta: day % 3 ? 1 : -0.5,
            });
          if (day === 5) journal = upsertDay(journal, {
            date: shiftDate(localDate(), -day), title: 'День без событий', note: 'Только заметка',
          });
        }
        await window.desktop.save(journal, revision);
      });
      await page.reload();
    }
    await page.waitForSelector('#chart');
    assert.equal((await page.evaluate(async () => (await window.desktop.load()).journal)).events[0].text, 'Проверка нового движка');
    assert.ok((await page.locator('.chart-candle').count()) > 0);
    assert.ok(
      await page.locator('.chart-candle').evaluateAll(nodes =>
        nodes.every(node => node.parentElement?.getAttribute('clip-path') === 'url(#price-plot)'),
      ),
      'price candles should stop at the top of the volume panel',
    );
    await page.locator('[data-interval="1440"]').click();
    assert.equal(await page.locator('.value-unit').count(), 0);
    assert.equal(/индекс/i.test(await page.locator('body').innerText()), false);
    assert.equal(await page.locator('[data-turnover]').isVisible(), true);
    const volume = await page.locator('[data-volume-count]').evaluateAll(nodes => nodes.map(node => ({ count: +node.dataset.volumeValue, height: +node.getAttribute('height') })));
    assert.ok(new Set(volume.filter(v => v.count).map(v => v.height)).size >= 4);
    const volumeStyles = await page.locator('[data-volume-count]').evaluateAll(nodes => nodes.map(node => ({ decorative: node.dataset.decorative === 'true', value: +node.dataset.volumeValue, fill: node.getAttribute('fill'), opacity: node.getAttribute('opacity') })));
    const decorative = volumeStyles.find(bar => bar.decorative && ['var(--up)', 'var(--down)'].includes(bar.fill));
    assert.ok(decorative, `Expected translucent directional volume with no event; got ${JSON.stringify(volumeStyles)}`);
    assert.equal(decorative.opacity, '0.12');
    const realBar = volumeStyles.find(bar => !bar.decorative && bar.value > 0);
    assert.ok(realBar, `Expected a real volume bar; got ${JSON.stringify(volumeStyles)}`);
    assert.ok(['var(--up)', 'var(--down)'].includes(realBar.fill));
    assert.equal(realBar.opacity, '0.48');
    assert.equal(Number((await page.locator("[data-turnover]").innerText()).replace(/\s/g,"").replace(",", ".")), volume.reduce((sum, v) => sum + v.count, 0));
    assert.ok(volume.every(v => v.height > 0 && v.height <= 48));
    assert.equal(await page.locator('[data-volume-average]').count(), 0);
    const dailyLabel = await page.locator('.market-summary').innerText();
    await page.locator('[data-interval="60"]').click();
    assert.notEqual(await page.locator('.market-summary').innerText(), dailyLabel);
    const visibleCount = await page.locator('[data-volume-count]').evaluateAll(nodes => nodes.reduce((sum,node) => sum + Number(node.dataset.volumeValue), 0));
    assert.equal(Number((await page.locator('[data-turnover]').innerText()).replace(/\s/g,'').replace(',', '.')), visibleCount);
    const labels = await page.locator('.market-summary span').allTextContents();
    assert.equal(labels[2].replace('Оборот за ',''), labels[0].replace('Макс. за ',''));
    await page.locator('[data-interval="1440"]').click();
    if (!mobile) {
      assert.equal(await page.locator('.product-label').isVisible(), false);
      const footerVersion = page.locator('.footer-version');
      const footerColors = await footerVersion.evaluate(el => ({
        text: getComputedStyle(el).color,
        dot: getComputedStyle(el.querySelector('.brand-dot')).color,
      }));
      assert.equal(footerColors.dot, footerColors.text);
      const volumeHandle = page.locator('#volume-resizer');
      assert.equal(await volumeHandle.isVisible(), true);
      const initialVolumeHeight = Number(await volumeHandle.getAttribute('aria-valuenow'));
      const handleBox = await volumeHandle.boundingBox();
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 - 30, { steps: 6 });
      await page.mouse.up();
      await page.waitForFunction((height) => Number(document.querySelector('#volume-resizer')?.getAttribute('aria-valuenow')) > height + 20, initialVolumeHeight);
      const storedVolumeHeight = await page.evaluate(() => localStorage.getItem('high-volume-panel-height'));
      assert.equal(Number(storedVolumeHeight), Number(await volumeHandle.getAttribute('aria-valuenow')));
      await page.reload();
      await page.waitForSelector('#volume-resizer[aria-valuenow]');
      assert.equal(await page.locator('#volume-resizer').getAttribute('aria-valuenow'), storedVolumeHeight);
      const candlePoints = await page.locator('#chart .chart-candle').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
      assert.ok(candlePoints.length > 5, 'chart needs enough candles for direction-aware card placement');
      await page.mouse.move(5, 5);
      await page.waitForTimeout(480);
      await page.mouse.move(candlePoints[1].x, candlePoints[1].y, { steps: 8 });
      await page.waitForSelector('#hover-card');
      await page.mouse.move(candlePoints.at(-2).x, candlePoints.at(-2).y, { steps: 20 });
      await page.waitForFunction(() => document.querySelector('#hover-card')?.dataset.dockSide === 'left');
      const leftCard = await page.locator('#hover-card').boundingBox();
      const leftGap = candlePoints.at(-2).x < leftCard.x
        ? leftCard.x - candlePoints.at(-2).x
        : candlePoints.at(-2).x > leftCard.x + leftCard.width
          ? candlePoints.at(-2).x - leftCard.x - leftCard.width
          : 0;
      assert.ok(leftGap <= 20, `card should sit beside its candle, gap=${leftGap}`);
      const cardOpacity = await page.locator('#hover-card').evaluate(el => {
        const color = getComputedStyle(el).backgroundColor;
        return Number(color.match(/\/\s*([\d.]+)\s*\)/)?.[1] ?? color.match(/,\s*([\d.]+)\s*\)$/)?.[1] ?? 1);
      });
      assert.ok(cardOpacity < 0.5, `hover card should let the chart show through; alpha=${cardOpacity}`);
      assert.equal(await page.locator('#focus-candle .focus-band').getAttribute('fill-opacity'), '.035');
      await page.screenshot({ path: path.join(shots, 'hover-card-left.png') });
      await page.mouse.move(candlePoints[1].x, candlePoints[1].y, { steps: 20 });
      await page.waitForFunction(() => document.querySelector('#hover-card')?.dataset.dockSide === 'right');
      const rightCard = await page.locator('#hover-card').boundingBox();
      const rightGap = candlePoints[1].x < rightCard.x
        ? rightCard.x - candlePoints[1].x
        : candlePoints[1].x > rightCard.x + rightCard.width
          ? candlePoints[1].x - rightCard.x - rightCard.width
          : 0;
      assert.ok(rightGap <= 20, `card should sit beside its candle, gap=${rightGap}`);
      await page.screenshot({ path: path.join(shots, 'hover-card-right.png') });
      await page.mouse.move(5, 5);
      await page.waitForTimeout(480);
      await page.locator('[data-interval="60"]').click();
      const chartBox = await page.locator('#chart').boundingBox();
      const probeCandle = page.locator('#chart .chart-candle').first();
      const panX = chartBox.x + chartBox.width * 0.42;
      const panY = chartBox.y + chartBox.height * 0.38;
      const lastRecorded = () => page.locator('#chart .chart-candle[data-recorded="true"]').last();
      const beforeVerticalPan = await lastRecorded().boundingBox();
      await page.mouse.move(panX, panY);
      await page.mouse.down();
      await page.mouse.move(panX, panY + 42, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(80);
      const afterLockedVerticalPan = await lastRecorded().boundingBox();
      assert.equal(await page.locator('#chart').getAttribute('data-scale'), 'auto', 'Auto must stay enabled during vertical dragging');
      assert.ok(Math.abs(afterLockedVerticalPan.y - beforeVerticalPan.y) < 2, 'Auto must lock vertical panning');
      const beforeFuturePan = await lastRecorded().boundingBox();
      const futureBars = () => page.locator('#chart .gap-candle[data-future="true"]');
      const emptyBarsBefore = await futureBars().count();
      await page.mouse.move(panX, panY);
      await page.mouse.down();
      await page.mouse.move(panX - chartBox.width * 0.30, panY, { steps: 10 });
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector('#chart .gap-candle[data-future="true"]'));
      const afterFuturePan = await lastRecorded().boundingBox();
      assert.equal(await page.locator('#chart').getAttribute('data-scale'), 'auto', 'horizontal panning must preserve Auto');
      assert.ok(afterFuturePan.x < beforeFuturePan.x - 25, 'dragging left should move the recorded chart left and reveal future space on the right');
      assert.ok(await futureBars().count() > emptyBarsBefore, 'future bars should be visibly empty, flat, and unrecorded');
      await page.locator('#auto-range').click();
      await page.waitForFunction(() => document.querySelector('#chart')?.dataset.scale === 'manual');
      const beforeUnlockedVerticalPan = await lastRecorded().boundingBox();
      await page.mouse.move(panX, panY);
      await page.mouse.down();
      await page.mouse.move(panX, panY + 42, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(60);
      const afterUnlockedVerticalPan = await lastRecorded().boundingBox();
      assert.ok(afterUnlockedVerticalPan.y > beforeUnlockedVerticalPan.y + 20, 'vertical panning should work after Auto is turned off');
      await page.locator('#auto-range').click();
      await page.waitForFunction(() => document.querySelector('#chart')?.dataset.scale === 'auto');
      const priceScaleBox = await page.locator('#chart').boundingBox();
      const candleSpread = async () => page.locator('#chart .chart-candle').evaluateAll(nodes => {
        const centers = nodes.map(node => {
          const rect = node.getBoundingClientRect();
          return rect.top + rect.height / 2;
        });
        return Math.max(...centers) - Math.min(...centers);
      });
      const beforePriceZoom = await candleSpread();
      await page.mouse.move(priceScaleBox.x + priceScaleBox.width - 18, priceScaleBox.y + priceScaleBox.height * 0.42);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(80);
      assert.equal(await page.locator('#chart').getAttribute('data-scale'), 'auto', 'Auto must block manual vertical scaling too');
      assert.ok(Math.abs((await candleSpread()) - beforePriceZoom) < 0.1, 'vertical wheel scaling should not alter candles while Auto is on');
      await page.locator('#auto-range').click();
      await page.waitForFunction(() => document.querySelector('#chart')?.dataset.scale === 'manual');
      await page.mouse.move(priceScaleBox.x + priceScaleBox.width - 18, priceScaleBox.y + priceScaleBox.height * 0.42);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(80);
      assert.ok(await candleSpread() < beforePriceZoom, 'wheel over the right price scale should zoom out vertically');
      const beforeAxisDrag = await candleSpread();
      const axisX = priceScaleBox.x + priceScaleBox.width - 18;
      const axisY = priceScaleBox.y + priceScaleBox.height * 0.42;
      await page.mouse.move(axisX, axisY);
      await page.mouse.down();
      await page.mouse.move(axisX, axisY - 70, {steps:8});
      await page.mouse.up();
      await page.waitForTimeout(80);
      assert.ok(await candleSpread() > beforeAxisDrag * 1.1, 'dragging the price axis up stretches candle heights');
      const afterAxisUp = await candleSpread();
      await page.mouse.move(axisX, axisY);
      await page.mouse.down();
      await page.mouse.move(axisX, axisY + 70, {steps:8});
      await page.mouse.up();
      await page.waitForTimeout(80);
      assert.ok(await candleSpread() < afterAxisUp / 1.1, 'dragging the price axis down compresses candle heights');
      await page.locator('#auto-range').click();
      await page.waitForFunction(() => document.querySelector('#chart')?.dataset.scale === 'auto');
      await page.mouse.move(5, 5);
      await page.waitForTimeout(480);
      await page.locator('#rail-trend').click();
      for (const tool of ['trend', 'arrow', 'vertical']) {
        const option = page.locator(`#drawing-menu [data-drawing-option="${tool}"]`);
        assert.ok((await option.locator('small').innerText()).length > 12, `${tool} should explain what it draws`);
      }
      await page.locator('#drawing-menu').screenshot({ path: path.join(shots, 'drawing-menu.png') });
      await page.locator('#drawing-menu [data-drawing-option="trend"]').click();
      assert.equal(await page.locator('#rail-trend').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#rail-trend').getAttribute('title'), null, 'trend tool must not show the native long-press tooltip');
      const beforeToolPan = await lastRecorded().boundingBox();
      await page.keyboard.down('Shift');
      await page.mouse.move(panX, panY);
      await page.mouse.down();
      await page.mouse.move(panX, panY + 36, { steps: 8 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.waitForTimeout(60);
      const afterLockedToolPan = await lastRecorded().boundingBox();
      assert.equal(await page.locator('#chart').getAttribute('data-scale'), 'auto', 'drawing mode must not bypass the Auto vertical lock');
      assert.ok(Math.abs(afterLockedToolPan.y - beforeToolPan.y) < 2, 'Shift-drag must not move the price scale while Auto is enabled');
      await page.locator('#auto-range').click();
      await page.waitForFunction(() => document.querySelector('#chart')?.dataset.scale === 'manual');
      const unlockedToolPan = await lastRecorded().boundingBox();
      await page.keyboard.down('Shift');
      await page.mouse.move(panX, panY);
      await page.mouse.down();
      await page.mouse.move(panX, panY + 36, { steps: 8 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      await page.waitForFunction(() => document.querySelector('#chart')?.dataset.scale === 'manual');
      const afterToolPan = await lastRecorded().boundingBox();
      assert.ok(afterToolPan.y > unlockedToolPan.y + 16, 'with Auto off, Shift-drag should pan vertically and preserve the active drawing tool');
      assert.equal(await page.locator('#rail-trend').getAttribute('aria-pressed'), 'true');
      const drawBox = await page.locator('#chart').boundingBox();
      const futureXs = await futureBars().evaluateAll(nodes => nodes.slice(0, 2).map(node => {
        const rect = node.getBoundingClientRect();
        return rect.left + rect.width / 2;
      }));
      assert.ok(futureXs.length >= 2, 'horizontal panning should expose at least two future drawing points');
      await page.mouse.click(futureXs[0], drawBox.y + drawBox.height * 0.2);
      const secondFutureX = await futureBars().nth(1).evaluate(node => {
        const rect = node.getBoundingClientRect();
        return rect.left + rect.width / 2;
      });
      await page.mouse.click(secondFutureX, drawBox.y + drawBox.height * 0.27);
      assert.equal(await page.locator('#drawing-layer .drawn-trend').count(), 1, 'trend line should draw between points in empty future space');
      await page.locator('#rail-trend').click();
      await page.locator('#drawing-menu [data-drawing-option="arrow"]').click();
      assert.equal(await page.locator('#rail-trend').getAttribute('aria-pressed'), 'true');
      await page.mouse.click(drawBox.x + drawBox.width * 0.52, drawBox.y + drawBox.height * 0.31);
      await page.mouse.click(drawBox.x + drawBox.width * 0.62, drawBox.y + drawBox.height * 0.25);
      const arrow = page.locator('#drawing-layer [data-drawing-type="arrow"]');
      assert.equal(await arrow.count(), 1, 'arrow should appear after choosing two chart points');
      assert.match(await arrow.getAttribute('marker-end'), /trend-arrow/);
      await page.locator('#rail-trend').click();
      await page.locator('#drawing-menu [data-drawing-option="vertical"]').click();
      await page.mouse.click(drawBox.x + drawBox.width * 0.86, drawBox.y + drawBox.height * 0.34);
      assert.equal(await page.locator('#drawing-layer .drawn-vertical').count(), 1, 'vertical line should appear after one chart click');
      await page.locator('#rail-undo').click();
      assert.equal(await page.locator('#drawing-layer .drawn-vertical').count(), 0, 'vertical line should be undoable');
      await page.locator('#rail-undo').click();
      assert.equal(await page.locator('#drawing-layer [data-drawing-type="arrow"]').count(), 0, 'arrow should be undoable');
      assert.equal(await page.locator('#drawing-layer .drawn-trend').count(), 1, 'undoing the other tools should preserve the trend line');
      await page.locator('#favorite-day').click();
      await page.waitForFunction(() => document.querySelector('#favorite-day')?.getAttribute('aria-pressed') === 'true');
      await page.reload();
      await page.waitForSelector('#favorite-day[aria-pressed="true"]');
      await page.locator('[data-ledger="favorites"]').click();
      await page.waitForFunction(() => document.querySelector('[data-ledger="favorites"]')?.classList.contains('active'));
      await page.waitForSelector('.favorite-day-row', { timeout: 1500 }).catch(() => {});
      assert.equal(await page.locator('.favorite-day-row').count(), 1, JSON.stringify({ active: await page.locator('[data-ledger="favorites"]').getAttribute('class'), favorites: (await page.evaluate(async () => (await window.desktop.load()).journal.settings.favoriteDays)), errors, body: await page.locator('#activity-content').innerText() }));
      await page.locator('[data-ledger="summary"]').click();
      assert.equal(await page.locator('.period-summary').count(), 1);
      await page.locator('[data-summary-period="month"]').click();
      assert.equal(await page.locator('.period-summary').count(), 1);
      await page.locator('[data-ledger="notes"]').click();
      const noteDate = page.locator('.quick-note label > span');
      assert.equal(await noteDate.evaluate(el => getComputedStyle(el).whiteSpace), 'nowrap');
      assert.ok(await noteDate.evaluate(el => el.getBoundingClientRect().height < 20));
      await page.locator('[data-ledger="events"]').click();
      await page.locator('#rail-note').click();
      const firstPrompt = await page.locator('dialog[open] .modal-description').innerText();
      const prompts = await page.evaluate(async () => (await import('/src/day-examples.mjs')).DAY_PROMPTS);
      assert.ok(prompts.includes(firstPrompt));
      await page.locator('#cancel-form').click();
      await page.locator('#rail-note').click();
      const secondPrompt = await page.locator('dialog[open] .modal-description').innerText();
      assert.ok(prompts.includes(secondPrompt));
      assert.notEqual(secondPrompt, firstPrompt);
      await page.locator('#cancel-form').click();
    } else {
      await page.locator('[data-ledger="favorites"]').click();
      await page.locator('[data-ledger="summary"]').click();
      assert.equal(await page.locator('.period-summary').count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    if (mobile) {
      assert.equal(await page.locator('.titlebar').isVisible(), false);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.mouse.move(5, 5);
    await page.locator("[data-visible-min]").evaluate(el => el.focus());
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(shots, mobile ? 'phone.png' : 'desktop.png'), fullPage: true });
    if (mobile) {
      const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent'));
      await page.locator('#home-button').click();
      await page.locator('.graph-actions summary').click();
      await page.locator('[data-delete-graph]').click();
      await page.keyboard.press('Enter');
      await page.waitForSelector('#start-form');
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent')), accent);
      await page.reload();
      await page.waitForSelector('#start-form');
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent')), accent);
      assert.equal(await page.locator('[name=preset]:checked').inputValue(), 'terminal');
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS: desktop + phone layout, event save, reopen through Tauri bundle (mock native IPC).');
} finally {
  await browser?.close();
  server.close();
}
