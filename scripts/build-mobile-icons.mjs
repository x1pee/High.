import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const root = path.resolve(import.meta.dirname, "..");
const svg = await fs.readFile(path.join(root, "assets/icon.svg"));
const ios = path.join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
await sharp(svg).resize(1024, 1024).flatten({ background: "#0b0c0f" }).png().toFile(ios);
for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  const folder = path.join(root, "android/app/src/main/res", `mipmap-${density}`);
  await fs.mkdir(folder, { recursive: true });
  const image = await sharp(svg).resize(size, size).png().toBuffer();
  await Promise.all(["ic_launcher.png", "ic_launcher_round.png"].map(name => fs.writeFile(path.join(folder, name), image)));
  const foreground = await sharp(svg).resize(Math.round(size * 1.45)).extend({ top: Math.round(size * .4), bottom: Math.round(size * .4), left: Math.round(size * .4), right: Math.round(size * .4), background: { r: 0, g: 0, b: 0, alpha: 0 } }).resize(size * 2, size * 2).png().toBuffer();
  await fs.writeFile(path.join(folder, "ic_launcher_foreground.png"), foreground);
}
console.log("Native icons updated");
