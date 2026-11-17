// Finds the bundled tool and the helpers it drives. Nothing is run here.
//
//   packaged     <resources>/bin/<platform>-<arch>/<tool>[.exe] and its helpers beside it.
//                Nothing is ever looked up on PATH.
//   development  <project>/tool/dist/<platform>-<arch>/<tool>[.exe]; helpers beside it, or
//                failing that on PATH (development only).
//   override     a test hook: run this script with this Node in place of the tool
//                (the stand-in in test/standin-tool.cjs). Never honoured in a packaged app.
//
// The folder is named as Node names the system and processor, and only so:
// win32-x64, darwin-arm64, linux-x64, linux-arm64. A universal macOS tool is
// staged under darwin-arm64. One spelling everywhere means the packager, the
// adapter and the installed check can never look in different places (build 2
// lost time to a second spelling).
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function isRunnable(file, platform) {
  try {
    if (!fs.statSync(file).isFile()) return false;
    if (platform !== 'win32') fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The one folder name for a system and processor. */
const folderName = (platform, arch) => `${platform}-${arch}`;

function onPath(name, env, platform) {
  const raw = env.PATH ?? env.Path ?? '';
  for (const entry of raw.split(path.delimiter)) {
    const dir = entry.trim().replace(/^"|"$/g, '');
    if (!dir || !path.isAbsolute(dir)) continue; // never the current folder
    const file = path.join(dir, name);
    if (isRunnable(file, platform)) return file;
  }
  return null;
}

/**
 * @param {{
 *   packaged: boolean,
 *   resourcesPath?: string,
 *   projectDir?: string,
 *   platform?: NodeJS.Platform,
 *   arch?: string,
 *   env?: NodeJS.ProcessEnv,
 *   toolName: string,
 *   helpers?: string[],
 *   override?: { script: string, node?: string, config?: string } | null,
 * }} options
 * @returns {{ ok: true, command: string, prefixArgs: string[], binary: string,
 *             source: 'packaged' | 'development' | 'override',
 *             helpers: Record<string, { file: string | null, source: 'beside' | 'path' | 'override' | null }> }
 *   | { ok: false, code: 'TOOL_NOT_FOUND', details: string }}
 */
function locateTool(options) {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const env = options.env ?? process.env;
  const exe = platform === 'win32' ? '.exe' : '';
  const toolFile = `${options.toolName}${exe}`;
  const helperNames = options.helpers ?? [];

  if (options.override && !options.packaged) {
    const script = path.resolve(options.override.script);
    const node = options.override.node ?? onPath(`node${exe}`, env, platform);
    if (!isRunnable(script, 'win32')) return { ok: false, code: 'TOOL_NOT_FOUND', details: `The stand-in tool ${script} does not exist.` };
    if (!node) return { ok: false, code: 'TOOL_NOT_FOUND', details: 'No node was found on PATH to run the stand-in tool.' };
    const prefixArgs = [script];
    if (options.override.config) prefixArgs.push(`--standin-config=${path.resolve(options.override.config)}`);
    const helpers = Object.fromEntries(helperNames.map((h) => [h, { file: path.join(path.dirname(script), `${h}${exe}`), source: 'override' }]));
    return { ok: true, command: node, prefixArgs, binary: script, source: 'override', helpers };
  }

  const base = options.packaged ? path.join(options.resourcesPath ?? '', 'bin') : path.join(options.projectDir ?? '', 'tool', 'dist');
  const dir = path.join(base, folderName(platform, arch));
  const tool = path.join(dir, toolFile);
  if (!isRunnable(tool, platform)) return { ok: false, code: 'TOOL_NOT_FOUND', details: `No runnable ${toolFile} was found. Looked for: ${tool}` };
  const helpers = {};
  for (const name of helperNames) {
    const file = path.join(dir, `${name}${exe}`);
    if (isRunnable(file, platform)) helpers[name] = { file, source: 'beside' };
    else {
      const found = options.packaged ? null : onPath(`${name}${exe}`, env, platform);
      helpers[name] = found ? { file: found, source: 'path' } : { file: null, source: null };
    }
  }
  return { ok: true, command: tool, prefixArgs: [], binary: tool, source: options.packaged ? 'packaged' : 'development', helpers };
}

module.exports = { locateTool, folderName };
