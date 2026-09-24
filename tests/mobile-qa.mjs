import { chromium } from "playwright";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "../mobile-dist");
const mime = { ".html": "text/html", ".css": "text/css", ".mjs": "text/javascript", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const body = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForSelector("#start-form");
  assert.equal(await page.locator("#application-form").count(), 0);
  assert.equal(await page.locator("#start-form [name=name]").inputValue(), "LIFEUSDT");
  await page.screenshot({ path: path.resolve(root, "../../../work/mobile-onboarding-1991.png"), fullPage: true });
  await page.locator("#start-form [type=submit]").click();
  await page.waitForSelector("#coin-form");
  await page.locator("#coin-form [type=submit]").click();
  await page.waitForSelector("#chart");
  await page.screenshot({ path: path.resolve(root, "../../../work/mobile-chart-1991.png"), fullPage: true });
  const snapshot = await page.evaluate(() => window.desktop.load());
  assert(snapshot.journal);
  assert.equal(snapshot.journal.events.length, 0);
  await page.locator("#add-event").click();
  await page.locator("[name=text]").fill("Мобильная запись");
  await page.locator("[name=delta]").fill("5");
  await page.locator("#event-form [type=submit]").click();
  await page.waitForFunction(async () => (await window.desktop.load()).journal.events.length === 1);
  await page.screenshot({ path: path.resolve(root, "../../../work/mobile-event-1991.png"), fullPage: true });
  await page.reload();
  await page.waitForSelector("#chart");
  assert.equal((await page.evaluate(() => window.desktop.load())).journal.id, snapshot.journal.id);
  assert.equal((await page.evaluate(() => window.desktop.load())).journal.events.length, 1);
  await page.evaluate(id => window.desktop.deleteGraph(id), snapshot.journal.id);
  assert.equal((await page.evaluate(() => window.desktop.trash())).length, 1);
  await page.evaluate(id => window.desktop.restoreGraph(id), snapshot.journal.id);
  assert.equal((await page.evaluate(() => window.desktop.load())).journal.events.length, 1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 3, `horizontal overflow: ${overflow}px`);
  assert.deepEqual(errors, []);
  console.log("Mobile browser: onboarding, coin, local persistence, layout PASS");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

