// Packages the app as out/<exeName>-win32-x64/<exeName>.exe with @electron/packager.
// Names come from app.config.json. Only what the app runs is included:
// package.json, app.config.json, electron/ (without the test instrumentation),
// the built page in dist/ and the icon. No node_modules: the main process has
// no runtime dependencies. If the app gains one, bundle the main process
// rather than shipping node_modules.
import { packager } from '@electron/packager';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(root, 'app.config.json'), 'utf8'));
for (const needed of ['dist/index.html', 'build/icon.ico']) {
  if (!existsSync(join(root, needed))) throw new Error(`${needed} is missing. Run "pnpm build" and "pnpm icon" first.`);
}

const keep = [/^\/package\.json$/, /^\/app\.config\.json$/, /^\/electron(\/|$)/, /^\/dist(\/|$)/, /^\/build(\/icon\.ico)?$/];
const paths = await packager({
  dir: root,
  out: join(root, 'out'),
  name: config.exeName,
  executableName: config.exeName,
  platform: 'win32',
  arch: 'x64',
  electronVersion: pkg.devDependencies.electron,
  appVersion: pkg.version,
  overwrite: true,
  asar: true,
  prune: false,
  icon: join(root, 'build', 'icon.ico'),
  appCopyright: config.company,
  win32metadata: { CompanyName: config.company, FileDescription: config.productName, ProductName: config.productName, InternalName: config.exeName, OriginalFilename: `${config.exeName}.exe` },
  ignore: (file) => {
    if (file === '') return false;
    if (file === '/electron/qa.cjs') return true;
    return !keep.some((pattern) => pattern.test(file));
  },
});
console.log(`packaged: ${paths.join(', ')}`);
