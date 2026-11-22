// Turns the tool's capabilities answer into what the page is told (`ToolStatus`
// in src/bridge.ts), following docs/TOOL-CONTRACT.md ("Capabilities"). Also keeps
// the last good answer on disk, keyed by the binaries' size and modified time, so
// a launch can show a ready state while its own check is still running.
import fs from 'node:fs';
import path from 'node:path';
import type { ToolStatus } from '../../src/bridge.ts';
import type { Located } from './locate.ts';

/** The capabilities document, as far as the shell reads it. */
export interface Capabilities {
  schema?: unknown;
  schema_version?: unknown;
  tool?: unknown;
  tool_version?: unknown;
  events?: unknown;
  [key: string]: unknown;
}

export interface ToolError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type CapabilitiesAnswer = { ok: true; capabilities: Capabilities } | { ok: false; error: ToolError };

export function toolStatus(answer: CapabilitiesAnswer): ToolStatus {
  if (!answer.ok) {
    const details = [answer.error.code, answer.error.message, Object.keys(answer.error.details ?? {}).length ? JSON.stringify(answer.error.details) : ''].filter(Boolean).join('\n');
    return { state: 'damaged', code: answer.error.code, details };
  }
  const doc = answer.capabilities;
  return { state: 'ready', code: null, details: `${String(doc.tool ?? 'tool')} ${String(doc.tool_version ?? '')}, events ${JSON.stringify(doc.events)}` };
}

function stamp(file: string | null): string | null {
  if (!file) return null;
  try {
    const s = fs.statSync(file);
    return `${file}|${s.size}|${Math.round(s.mtimeMs)}`;
  } catch {
    return `${file}|missing`;
  }
}

/** What the cached answer depends on: the tool binary and every helper beside it. */
export function cacheKey(located: Located): string | null {
  if (!located.ok) return null;
  return [stamp(located.binary), ...Object.values(located.helpers).map((h) => stamp(h.file))].join('\n');
}

/** The last good capabilities answer, kept in the data folder. Used only while this launch's own check runs. */
export function createCapabilitiesCache(dataDir: string) {
  const file = path.join(dataDir, 'tool', 'capabilities.json');
  return {
    read(located: Located): CapabilitiesAnswer | null {
      const key = cacheKey(located);
      if (!key) return null;
      try {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as { key?: unknown; answer?: CapabilitiesAnswer };
        return saved.key === key && saved.answer?.ok === true ? saved.answer : null;
      } catch {
        return null;
      }
    },
    write(located: Located, answer: CapabilitiesAnswer): void {
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
