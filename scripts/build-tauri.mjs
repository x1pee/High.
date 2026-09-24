import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { applyDisplayVersion, isDisplayVersion, parseReleaseHistory } from './release-history.mjs';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'tauri-dist');
const appVersion = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).appVersion;
if (!isDisplayVersion(appVersion)) throw new Error('Invalid appVersion in package.json');
const changelog = await fs.readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
const releaseHistory = parseReleaseHistory(changelog);
await fs.mkdir(out, { recursive: true });
await fs.cp(path.join(root, 'src'), path.join(out, 'src'), { recursive: true });
await fs.cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
const appPath = path.join(out, 'src/app.mjs');
await fs.writeFile(appPath, applyDisplayVersion(await fs.readFile(appPath, 'utf8'), appVersion));
let html = await fs.readFile(path.join(root, 'src/index.html'), 'utf8');
html = html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?>/i, '')
  .replaceAll('href="../assets/', 'href="assets/')
  .replace(/href="(styles|terminal|mobile)\.css"/g, 'href="src/$1.css"')
  .replace('src="app.mjs"', 'src="src/app.mjs"');
await fs.writeFile(path.join(out, 'index.html'), html);
// Reuse the exact desktop recovery/revision/archive algorithms. Only the I/O
// boundary changes; no second implementation of journal rules is maintained.
await build({
  entryPoints: [path.join(root, 'src/tauri-bridge.mjs')], bundle: true,
  format: 'esm', platform: 'browser', target: 'es2022',
  outfile: path.join(out, 'src/tauri-bridge.mjs'),
  plugins: [{ name: 'release-history', setup(b) {
    b.onLoad({ filter: /release-history\.mjs$/ }, args => {
      if (args.path !== path.join(root, 'src/release-history.mjs')) return;
      return { contents: `export const RELEASE_HISTORY = ${JSON.stringify(releaseHistory)};`, loader: 'js' };
    });
  }}, { name: 'native-profile-io', setup(b) {
    b.onResolve({ filter: /^node:(fs\/promises|path|crypto)$/ }, args => ({ path: args.path, namespace: 'native' }));
    b.onLoad({ filter: /.*/, namespace: 'native' }, args => ({
      contents: args.path === 'node:crypto'
        ? `import { sha256 } from '@noble/hashes/sha2.js'; export function createHash(){let value;return {update(x){value=x;return this},digest(){return Array.from(sha256(new TextEncoder().encode(value)),b=>b.toString(16).padStart(2,'0')).join('')}}}`
        : args.path === 'node:path'
          ? `export const join=(...p)=>p.filter(Boolean).join('/'); export const basename=p=>p.split('/').pop();`
          : `export * from './src/tauri-files.mjs';`,
      resolveDir: root, loader: 'js',
    }));
  }}],
});
const bridgePath = path.join(out, 'src/tauri-bridge.mjs');
await fs.writeFile(bridgePath, applyDisplayVersion(await fs.readFile(bridgePath, 'utf8'), appVersion));
console.log('Tauri assets prepared:', out);
