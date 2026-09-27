import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const work = path.resolve(root, '../../work');
const profile = await fs.mkdtemp(path.join(work, 'tauri-ui-profile-'));
const shots = path.join(work, 'website-screenshots-en');
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
  for (const mobile of [false]) {
    const context = await browser.newContext({ deviceScaleFactor: 2, locale: "en-US", viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 1050 } });
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
      if (!localStorage.getItem("high-language")) localStorage.setItem("high-language", "en");
      window.__TAURI__ = { core: { invoke: async (command, args) => {
        try { return await window.nativeInvoke(command, args); }
        catch (e) { throw { message: e.message, code: e.message.includes('ENOENT') ? 'ENOENT' : 'EIO' }; }
      } }, event: { listen: async () => {} } };
    });
    const {demoJournal, validateJournal} = await import('../src/domain.mjs');
    const demo = demoJournal();
    demo.settings.coin={color:'mint',symbol:'strata',rim:'classic'}; demo.settings.name='LIFEUSD'; demo.settings.appearance={palette:'amber',chartColors:'classic'};
    const titles=['Small steps, real progress','A little room to breathe','Back in my rhythm','Making space for what matters','A fresh perspective','Finding my balance','A day well spent'];
    const positive=['Finished a project I cared about','A long walk without my phone','Made time for a friend','Showed up for my workout','Read a chapter before bed','Cooked something new'];
    const negative=['A slower start than I hoped','Too much time on my phone','Plans changed. Took a breath.'];
    demo.events.forEach((e,i)=>e.text=(e.delta>=0?positive:negative)[i%(e.delta>=0?positive.length:negative.length)]);
    demo.days.forEach((d,i)=>{d.title=titles[i%titles.length];d.note='Made time for the things that matter. Not everything went to plan, but I kept going. That counts.';});
    demo.days.at(-1).title='Small steps, real progress';
    demo.events.at(-1).delta=18; demo.events.at(-1).text='Finished a project I cared about';
    demo.events.at(-2).delta=12; demo.events.at(-2).text='A morning walk. A clearer mind.';
    await fs.writeFile(path.join(profile,'journal.json'),JSON.stringify(validateJournal(demo)));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.waitForSelector('#add-event');
    await page.waitForTimeout(600);
    await fs.writeFile(path.join(shots,'visible-text.json'),JSON.stringify(await page.locator('body').innerText(),null,2));
    const cleanEnglish=async()=>assert.deepEqual((await page.locator('body').innerText()).replaceAll('Русский','').split('\n').filter(x=>/[А-Яа-яЁё]/.test(x)),[]);
    await cleanEnglish();
    await page.mouse.move(0,0);
    await page.screenshot({animations: "disabled",path:path.join(shots,'01-chart.png')});
    await page.locator('#add-event').click();
    await page.locator('[name=text]').fill('Made time for a long walk. Came back with a clearer mind.');
    await page.locator('[name=delta]').fill('1.5');
    await page.waitForTimeout(450);
    await cleanEnglish();
    await page.screenshot({animations: "disabled",path:path.join(shots,'02-add-event.png')});
    await page.locator('dialog .modal-close').click();
    await page.locator('[data-view=journal]').click();
    await cleanEnglish();
    await page.screenshot({animations: "disabled",path:path.join(shots,'03-journal.png')});
    await page.locator('#settings').click();
    for(const tab of ['appearance','general','data','application','experimental']) {
      await page.locator('[data-settings-tab="'+tab+'"]').click();
      await page.waitForTimeout(50); await cleanEnglish();
    }
    await page.locator('[data-settings-tab=appearance]').click();
    const before=await page.evaluate(async()=>JSON.stringify((await window.desktop.load()).journal.events));
    await page.locator('[name=language]').selectOption('ru');
    await page.locator('.settings-save [type=submit]').click();
    await page.waitForFunction(()=>document.documentElement.lang==='ru');
    assert.equal(await page.locator('#add-event').innerText(),'Добавить событие');
    assert.equal(await page.evaluate(async()=>JSON.stringify((await window.desktop.load()).journal.events)),before);
    await page.locator('#settings').click();
    await page.locator('[name=language]').selectOption('en');
    await page.locator('.settings-save [type=submit]').click();
    await page.waitForFunction(()=>document.documentElement.lang==='en');
    await page.locator('#updates').click(); await page.waitForSelector('.release-row'); await cleanEnglish();
    await page.locator('dialog .modal-close').click();
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await cleanEnglish();
    await page.screenshot({animations: "disabled",path:path.join(shots,'phone-qa.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: English screens, all settings, release history, RU/EN persistence, unchanged events, phone width.');
    await context.close();
  }
} finally { await browser?.close(); server.close(); }

