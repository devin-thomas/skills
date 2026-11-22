// Where the app's own files are. The main process runs from two places: bundled into
// dist/electron/main.mjs (development and the packaged app, inside app.asar), and as these
// sources, imported directly by the tests and the shell check. A path relative to this file
// would differ between the two, so everything is found from the project root: the nearest
// folder above that holds package.json (the app's own package.json inside app.asar).
import fs from 'node:fs';
import path from 'node:path';

function findRoot(start: string): string {
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    if (path.dirname(dir) === dir) throw new Error(`no package.json in or above ${start}`);
  }
}

export const ROOT = findRoot(import.meta.dirname);
