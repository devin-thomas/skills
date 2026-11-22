// Typing latency in the real shell. Starts the development shell without
// taking focus, sends 220 real key events into the main text field on an empty
// document and again with 20,000 characters loaded, and times the palette shortcut to the
// palette. Measured by @uppercut-labs/electron-qa-measurements inside the app
// (electron/qa.ts) and judged by qa/premium-gate.ts against the published premium bar (95th
// percentile 50 ms or less, no key over 100 ms, palette within 50 ms, the window never focused).
//
// The times run from the key event's timestamp to the end of the frame that
// rendered the change, on the page's clock. They leave out the compositor and
// the display, so they are a floor, not key-to-photon.
//
// The window opens on the primary display. Run it only when the owner has said
// the machine is free.
//
// Usage: node qa/typing.ts   (writes qa/evidence/typing.json)
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { PaletteResult, Stats, TypingResult } from '@uppercut-labs/electron-qa-measurements';
import type { GateResult } from './premium-gate.ts';
import { launchDev, root } from '../scripts/lib/launch.ts';

interface Report {
  display: { hz: number; scale: number };
  emptyDraft: TypingResult;
  longDraft: TypingResult;
  palette: PaletteResult;
  gate: GateResult;
  passed: boolean;
  error?: string;
}

const evidence = join(root, 'qa', 'evidence');
const dataDir = join(root, 'qa', 'data', 'typing');
const out = join(evidence, 'typing.json');

mkdirSync(evidence, { recursive: true });
rmSync(out, { force: true });
rmSync(dataDir, { recursive: true, force: true });
const app = launchDev({ args: [`--qa-typing=${out}`], dataDir, timeoutMs: 120_000 });
await app.exited;
rmSync(dataDir, { recursive: true, force: true });

const report = JSON.parse(readFileSync(out, 'utf8')) as Report;
if (report.error) {
  console.error(`typing run FAILED inside the app: ${report.error}`);
  process.exit(1);
}
const line = (name: string, s: Stats) => `${name.padEnd(22)} p50 ${s.p50} ms, p95 ${s.p95} ms, max ${s.max} ms over ${s.samples} keys`;
console.log(`display ${report.display.hz} Hz at ${report.display.scale}x`);
console.log(line('empty document', report.emptyDraft.latency));
console.log(line('20,000 characters', report.longDraft.latency));
console.log(`palette open           p50 ${report.palette.open.p50} ms, max ${report.palette.open.max} ms over ${report.palette.open.samples} opens`);
console.log(report.gate.summary);
if (!report.passed) {
  console.error(`typing gate FAILED (${report.gate.judgedBy}): ${report.gate.reasons.join('; ')}`);
  process.exit(1);
}
console.log(`typing gate passed (${report.gate.judgedBy})`);
