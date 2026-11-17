// Turns the tool's capabilities answer into what the page is told (`ToolStatus`
// in src/bridge.ts), following docs/TOOL-CONTRACT.md ("Capabilities"). Also keeps
// the last good answer on disk, keyed by the binaries' size and modified time, so
// a launch can show a ready state while its own check is still running.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * @param {{ ok: true, capabilities: any } | { ok: false, error: { code: string, message: string, details?: object } }} answer
 * @returns {{ state: 'ready' | 'damaged', code: string | null, details: string | null }}
 */
function toolStatus(answer) {
  if (!answer.ok) {
    const details = [answer.error.code, answer.error.message, Object.keys(answer.error.details ?? {}).length ? JSON.stringify(answer.error.details) : ''].filter(Boolean).join('\n');
    return { state: 'damaged', code: answer.error.code, details };
  }
  const doc = answer.capabilities;
  return { state: 'ready', code: null, details: `${doc.tool ?? 'tool'} ${doc.tool_version ?? ''}, events ${JSON.stringify(doc.events)}` };
}

function stamp(file) {
  if (!file) return null;
  try {
    const s = fs.statSync(file);
    return `${file}|${s.size}|${Math.round(s.mtimeMs)}`;
  } catch {
    return `${file}|missing`;
  }
}

/** What the cached answer depends on: the tool binary and every helper beside it. */
function cacheKey(located) {
  if (!located.ok) return null;
  return [stamp(located.binary), ...Object.values(located.helpers ?? {}).map((h) => stamp(h.file))].join('\n');
}

/** The last good capabilities answer, kept in the data folder. Used only while this launch's own check runs. */
function createCapabilitiesCache(dataDir) {
  const file = path.join(dataDir, 'tool', 'capabilities.json');
  return {
    read(located) {
      const key = cacheKey(located);
      if (!key) return null;
      try {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        return saved.key === key && saved.answer?.ok === true ? saved.answer : null;
      } catch {
        return null;
      }
    },
    write(located, answer) {
      const key = cacheKey(located);
      try {
        if (!key || !answer.ok) {
          fs.rmSync(file, { force: true });
          return;
        }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(`${file}.tmp`, JSON.stringify({ key, answer, at: new Date().toISOString() }));
        fs.renameSync(`${file}.tmp`, file);
      } catch {
        // The cache is a convenience.
      }
    },
  };
}

module.exports = { toolStatus, createCapabilitiesCache, cacheKey };
