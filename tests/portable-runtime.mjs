import { chromium } from "playwright";
import { spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, ".."), work = path.resolve(root, "../../work");
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json")));
const exe = process.env.VYSHE_TEST_EXE || path.join(work, "build", pkg.build.portable.artifactName);
const dir = await fs.mkdtemp(path.join(work, "portable-smoke-"));
await fs.writeFile(path.join(dir, "preferences.json"), JSON.stringify({ initialized: true, autoStart: true, tray: true, autoUpdates: false }));
const env = { ...process.env, VYSHE_DATA_DIR: dir }; delete env.ELECTRON_RUN_AS_NODE;
const delay = ms => new Promise(r => setTimeout(r, ms));
async function wait(check, message, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await check()) return; await delay(250); }
  throw Error(message);
}
async function freePort() {
  const server = net.createServer();
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  await new Promise(r => server.close(r)); return port;
}
async function endpoint(port, suffix) {
  try { const response = await fetch(`http://127.0.0.1:${port}/${suffix}`); return response.ok ? await response.json() : null; }
  catch { return null; }
}
async function evaluateMain(url, expression) {
  const socket = new WebSocket(url);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(Error("main inspector timeout")); }, 10000);
    socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    socket.onerror = reject;
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timer); socket.close();
      if (message.result?.exceptionDetails || message.error) reject(Error(JSON.stringify(message)));
      else resolve(message.result.result.value);
    };
  });
}
let current;
async function launch(args = []) {
  const rendererPort = await freePort(), mainPort = await freePort(), started = Date.now();
  const child = spawn(exe, [`--remote-debugging-port=${rendererPort}`, "--remote-debugging-address=127.0.0.1", `--inspect=127.0.0.1:${mainPort}`, ...args], { env, windowsHide: true, stdio: "ignore" });
  current = { child };
  child.on("error", e => { current.error = e; });
  await wait(async () => {
    if (current.error) throw current.error;
    return !!await endpoint(rendererPort, "json/version");
  }, "portable did not open renderer endpoint");
  let main;
  await wait(async () => !!(main = (await endpoint(mainPort, "json/list"))?.[0]), "main inspector not ready");
  current.main = expression => evaluateMain(main.webSocketDebuggerUrl, expression);
  current.browser = await chromium.connectOverCDP(`http://127.0.0.1:${rendererPort}`);
  current.page = current.browser.contexts()[0].pages()[0];
  current.runtimeExe = await current.main("process.execPath");
  current.startupMs = Date.now() - started;
  current.visible = () => current.main("process.mainModule.require('electron').BrowserWindow.getAllWindows()[0].isVisible()");
  return current;
}
async function closeApp(run) {
  await run.page.locator("#close").click();
  await wait(() => run.child.exitCode !== null, "launcher did not exit after close", 30000);
  await run.browser.close();
  await wait(async () => {
    try { await fs.access(run.runtimeExe); return false; }
    catch (error) { if (error.code === "ENOENT") return true; throw error; }
  }, "temporary runtime must be cleaned after exit", 60000);
  current = null;
}
try {
  let run = await launch();
  const errors = []; run.page.on("pageerror", e => errors.push(e.message));
  await run.page.waitForSelector("#start-form");
  await wait(() => run.visible(), "manual launch should show the window");
  const prefs = await run.page.evaluate(() => window.desktop.preferences());
  assert.equal(prefs.portable, true);
  assert.equal(path.resolve(prefs.executable), path.resolve(exe));
  assert.equal(prefs.dataPath, dir);
  await run.page.locator("#start-form [type=submit]").click();
  await run.page.locator("#coin-form [type=submit]").click();
  await run.page.locator("#add-event").click();
  await run.page.locator("#event-form [name=text]").fill("Проверка EXE без установки");
  await run.page.locator("#event-form [name=delta]").fill("5");
  await run.page.locator("#event-form [type=submit]").click();
  await run.page.waitForSelector('.main-value:text-is("105")');
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, "journal.json"))).events[0].delta, 5);
  assert.equal(errors.length, 0);
  await run.page.screenshot({ path: path.join(work, "portable-smoke.png") });
  const firstStartupMs = run.startupMs;
  await closeApp(run);
  run = await launch(["--background"]);
  await run.page.waitForSelector("#add-event", { state: "attached" });
  assert.equal(await run.visible(), false, "Windows login argument must start hidden");
  assert.equal((await run.page.evaluate(() => window.desktop.load())).journal.events[0].delta, 5);
  const second = spawn(exe, [], { env, windowsHide: true, stdio: "ignore" });
  await wait(() => run.visible(), "opening portable again must reveal the existing window");
  await wait(() => second.exitCode !== null, "second launcher did not exit", 30000);
  assert.equal(await run.page.locator(".main-value").innerText(), "105");
  const restartMs = run.startupMs;
  await closeApp(run);
  console.log("PORTABLE EXE PASS", JSON.stringify({ exe, isolatedProfile: dir, firstStartupMs, restartMs, manualVisible: true, backgroundHidden: true, secondInstanceReveals: true, persistentRecord: true, temporaryRuntimeCleaned: true }));
} finally {
  if (current) {
    await current.page?.locator("#close").click({ timeout: 1000 }).catch(() => {});
    await current.browser?.close().catch(() => {});
  }
}
