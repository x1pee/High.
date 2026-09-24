import fs from "node:fs/promises";
import path from "node:path";
import { applyDisplayVersion, isDisplayVersion, parseReleaseHistory } from "./release-history.mjs";
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "mobile-dist");
const appVersion = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")).appVersion;
if (!isDisplayVersion(appVersion)) throw new Error("Invalid appVersion in package.json");
const changelog = await fs.readFile(path.join(root, "CHANGELOG.md"), "utf8");
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
await fs.cp(path.join(root, "src"), path.join(out, "src"), { recursive: true });
await fs.cp(path.join(root, "assets"), path.join(out, "assets"), { recursive: true });
await fs.writeFile(path.join(out, "src", "release-history.mjs"), `export const RELEASE_HISTORY = ${JSON.stringify(parseReleaseHistory(changelog))};\n`);
const mobileBridge = path.join(out, "src", "mobile-bridge.mjs");
await fs.writeFile(mobileBridge, applyDisplayVersion(await fs.readFile(mobileBridge, "utf8"), appVersion));
const appFile = path.join(out, "src", "app.mjs");
await fs.writeFile(appFile, applyDisplayVersion(await fs.readFile(appFile, "utf8"), appVersion));
let index = await fs.readFile(path.join(root, "src", "index.html"), "utf8");
index = index.replaceAll('href="../assets/', 'href="assets/')
  .replaceAll('href="styles.css"', 'href="src/styles.css"')
  .replaceAll('href="terminal.css"', 'href="src/terminal.css"')
  .replaceAll('href="mobile.css"', 'href="src/mobile.css"')
  .replaceAll('src="app.mjs"', 'src="src/app.mjs"');
await fs.writeFile(path.join(out, "index.html"), index);
console.log(`Mobile web bundle: ${out}`);
