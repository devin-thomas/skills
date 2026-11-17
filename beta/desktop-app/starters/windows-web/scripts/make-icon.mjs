// Builds build/icon.ico from build/icon.svg by rendering
// it at each icon size in the installed Edge, headless, and packing the PNGs
// into one .ico. The glyph's shape is used as drawn: no extra rounding or mask.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf8');
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const images = [];
for (const size of sizes) {
  const context = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  images.push({ size, png: await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }) });
  await context.close();
}
await browser.close();

// ICO container: 6-byte header, one 16-byte entry per image, then the PNG data.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
const entries = [];
let offset = 6 + 16 * images.length;
for (const { size, png } of images) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  entries.push(entry);
}
mkdirSync(join(root, 'build'), { recursive: true });
writeFileSync(join(root, 'build', 'icon.ico'), Buffer.concat([header, ...entries, ...images.map((i) => i.png)]));
writeFileSync(join(root, 'build', 'icon-256.png'), images.at(-1).png);
console.log(`build/icon.ico written with ${images.length} sizes: ${sizes.join(', ')}`);
