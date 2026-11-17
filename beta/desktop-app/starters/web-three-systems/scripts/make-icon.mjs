// Builds every icon the three systems need from build/icon.svg:
//
//   build/icon.ico            Windows: exe, shortcut and window icon (16 to 256 px)
//   build/icon.icns           macOS: the app bundle's icon (16 to 1024 px)
//   build/icon.png            Linux: window icon (512 px)
//   build/icons/<n>x<n>.png   Linux: the hicolor theme sizes the packages install
//   build/icon-256.png        kept for the scripts that already use it
//
// The SVG is rendered at each size in an installed browser, headless: Edge on
// Windows, Chrome elsewhere (set ICON_BROWSER to another Playwright channel).
// The glyph's shape is used as drawn: no extra rounding or mask. The macOS
// icon is the one exception to "as drawn" in size only: Apple's icon grid
// leaves a margin around the artwork, so the drawing is placed at 824/1024 of
// the canvas, centred, with nothing added or cut.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf8');
const ICO = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const LINUX = [16, 24, 32, 48, 64, 128, 256, 512];
// ICNS entries that hold PNG data: type code -> pixel size.
const ICNS = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512],
];
const MAC_ART = 824 / 1024;

const channel = process.env.ICON_BROWSER ?? (process.platform === 'win32' ? 'msedge' : 'chrome');
const browser = await chromium.launch({ channel, headless: true });
async function render(size, scale = 1) {
  const context = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const art = Math.round(size * scale);
  const inset = Math.floor((size - art) / 2);
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;position:absolute;left:${inset}px;top:${inset}px;width:${art}px;height:${art}px}</style>${svg}`,
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await context.close();
  return png;
}
const full = new Map();
for (const size of new Set([...ICO, ...LINUX])) full.set(size, await render(size));
const mac = new Map();
for (const size of new Set(ICNS.map(([, s]) => s))) mac.set(size, await render(size, MAC_ART));
await browser.close();

mkdirSync(join(root, 'build', 'icons'), { recursive: true });

// ICO container: 6-byte header, one 16-byte entry per image, then the PNG data.
{
  const images = ICO.map((size) => ({ size, png: full.get(size) }));
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
  writeFileSync(join(root, 'build', 'icon.ico'), Buffer.concat([header, ...entries, ...images.map((i) => i.png)]));
}

// ICNS container: "icns", total length, then for each image a 4-byte type, a
// 4-byte length that includes those 8 bytes, and the PNG data. Big-endian.
{
  const chunks = ICNS.map(([type, size]) => {
    const png = mac.get(size);
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([head, png]);
  });
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(body.length + 8, 4);
  writeFileSync(join(root, 'build', 'icon.icns'), Buffer.concat([head, body]));
}

for (const size of LINUX) writeFileSync(join(root, 'build', 'icons', `${size}x${size}.png`), full.get(size));
writeFileSync(join(root, 'build', 'icon.png'), full.get(512));
writeFileSync(join(root, 'build', 'icon-256.png'), full.get(256));
console.log(`build/icon.ico (${ICO.join(', ')}), build/icon.icns (${[...mac.keys()].join(', ')}), build/icon.png, build/icons/ (${LINUX.join(', ')}) written with ${channel}.`);
