// Builds every icon the three systems need from build/icon.svg, with
// @uppercut-labs/app-icon-generator:
//
//   build/icon.ico            Windows: exe, shortcut and window icon (16 to 256 px)
//   build/icon.icns           macOS: the app bundle's icon (16 to 1024 px, artwork at 824/1024)
//   build/icon.png            Linux: window icon (512 px)
//   build/icons/<n>x<n>.png   Linux: the hicolor theme sizes the packages install
//   build/icon-256.png        macOS and Linux window icon in development (electron/platform.ts)
//
// The glyph's shape is used as drawn: no extra rounding or mask.
//
//   node scripts/make-icon.ts      (pnpm icon)
import { generate } from '@uppercut-labs/app-icon-generator';
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './lib/root.ts';

const build = join(root, 'build');
const { files } = await generate(join(build, 'icon.svg'), { outDir: build, targets: ['ico', 'icns', 'linux'] });

// The packaging scripts and the Linux packages read build/icons/<n>x<n>.png.
rmSync(join(build, 'icons'), { recursive: true, force: true });
mkdirSync(join(build, 'icons'), { recursive: true });
for (const name of readdirSync(join(build, 'linux'))) copyFileSync(join(build, 'linux', name), join(build, 'icons', name));
copyFileSync(join(build, 'linux', '512x512.png'), join(build, 'icon.png'));
copyFileSync(join(build, 'linux', '256x256.png'), join(build, 'icon-256.png'));
rmSync(join(build, 'linux'), { recursive: true, force: true });
console.log(`icons: ${files.length} files from build/icon.svg`);
