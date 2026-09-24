import sharp from "sharp";
import fs from "node:fs/promises";
const base = new URL("../assets/", import.meta.url);
const svg = await fs.readFile(new URL("icon.svg", base));
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(
  sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((png, i) => {
  const at = 6 + 16 * i;
  header[at] = header[at + 1] = sizes[i] % 256;
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(png.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
await fs.writeFile(
  new URL("icon.ico", base),
  Buffer.concat([header, ...images]),
);
await fs.writeFile(new URL("icon.png", base), images.at(-1));
console.log("Generated PNG and ICO in 7 sizes from icon.svg");
