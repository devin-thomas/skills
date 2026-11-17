// Shared pieces for the adapter tests: a throwaway folder with a stand-in
// configuration, the stand-in located as the tool, and process checks.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { locateTool } = require('../electron/tool/locate.cjs');

const STANDIN = path.join(__dirname, 'standin-tool.cjs');

/** A folder for one test, removed afterwards, with the stand-in configured by `config`. */
function sandbox(t, config = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return sandboxAt(dir, config);
}

/** The same, for a folder that already exists (a host process rebuilds it from the path). */
function sandboxAt(dir, config = {}) {
  const log = path.join(dir, 'starts.ndjson');
  const configFile = path.join(dir, 'standin.json');
  fs.writeFileSync(configFile, JSON.stringify({ log, ...config }));
  const located = locateTool({ packaged: false, toolName: 'example-tool', override: { script: STANDIN, node: process.execPath, config: configFile } });
  const starts = () => {
    try {
      return fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  };
  return { dir, dataDir: path.join(dir, 'data'), located, starts, alive: () => starts().map((s) => s.pid).filter(isAlive) };
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function waitFor(condition, ms, step = 25) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise((r) => setTimeout(r, step));
  }
  return Boolean(await condition());
}

const stagingFolders = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^\.example-[0-9a-f]{32}\.tmp$/.test(n)) : []);

module.exports = { STANDIN, sandbox, sandboxAt, isAlive, waitFor, stagingFolders };
