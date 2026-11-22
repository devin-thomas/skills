// Builds the main process from electron/*.ts into dist/electron/ with rolldown:
//
//   dist/electron/main.mjs     the main process, an ES module, with every runtime package it uses
//                              (@uppercut-labs/electron-command-menu and
//                              electron-child-process-runner) bundled in, so the packaged app
//                              carries no node_modules. package.json's main.
//   dist/electron/preload.cjs  the preload: one CommonJS file that requires only electron, because
//                              the window is sandboxed
//   dist/electron/qa.mjs       development only (electron/qa.ts); its measurement packages stay
//                              outside, imported from node_modules at run time. Never packaged.
//
// After writing them it reads each one back and fails if it imports anything but electron and
// Node's own modules (qa.mjs: and its two measurement packages), or if the preload requires
// anything but electron.
//
//   node scripts/build-electron.ts
import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { build } from 'rolldown';
import { root } from './lib/root.ts';

const out = join(root, 'dist', 'electron');
const QA_PACKAGES = ['@uppercut-labs/electron-qa-measurements'];
const node = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

interface Output {
  entry: string;
  file: string;
  format: 'esm' | 'cjs';
  allowed: string[];
}
const OUTPUTS: Output[] = [
  { entry: 'main.ts', file: 'main.mjs', format: 'esm', allowed: ['electron'] },
  { entry: 'preload.ts', file: 'preload.cjs', format: 'cjs', allowed: ['electron'] },
  { entry: 'qa.ts', file: 'qa.mjs', format: 'esm', allowed: ['electron', ...QA_PACKAGES] },
];

/** Every module specifier a built file loads: static and dynamic imports, and require calls. */
export function specifiers(source: string): string[] {
  const found = new Set<string>();
  for (const pattern of [/\bfrom\s*["']([^"']+)["']/g, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, /\bimport\s*["']([^"']+)["']/g, /\brequire\(\s*["']([^"']+)["']\s*\)/g]) {
    for (const match of source.matchAll(pattern)) if (match[1]) found.add(match[1]);
  }
  return [...found];
}

const problems: string[] = [];
for (const { entry, file, format, allowed } of OUTPUTS) {
  await build({
    input: join(root, 'electron', entry),
    cwd: root,
    platform: 'node',
    logLevel: 'warn',
    external: (id) => allowed.includes(id) || node.has(id),
    output: {
      file: join(out, file),
      format,
      banner: `// Built by scripts/build-electron.ts from electron/${entry}. Do not edit.`,
    },
  });
  const source = readFileSync(join(out, file), 'utf8');
  const strangers = specifiers(source).filter((s) => !allowed.includes(s) && !node.has(s));
  if (strangers.length) problems.push(`dist/electron/${file} loads ${strangers.join(', ')}; it may load only ${allowed.join(', ')} and Node's own modules`);
  if (file === 'preload.cjs' && specifiers(source).some((s) => s !== 'electron')) problems.push(`dist/electron/preload.cjs requires ${specifiers(source).join(', ')}; a sandboxed preload may require only electron`);
}
if (problems.length) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exit(1);
}
console.log(`built ${OUTPUTS.map((o) => `dist/electron/${o.file}`).join(', ')}`);
