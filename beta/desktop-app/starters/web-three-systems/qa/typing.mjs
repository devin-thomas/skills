// Typing latency in the real shell. Starts the development shell without
// taking focus, sends 220 real key events into the main text field on an empty
// document and again with 20,000 characters loaded, and times the palette shortcut to the
// palette. Gate: 95th percentile 50 ms or less, no key over 100 ms, palette
// within 50 ms.
//
// The times run from the key event's timestamp to the end of the frame that
// rendered the change, on the page's clock. They leave out the compositor and
// the display, so they are a floor, not key-to-photon.
//
// The window opens on the primary display. Run it only when the owner has said
// the machine is free.
//
// Usage: node qa/typing.mjs   (writes qa/evidence/typing.json)
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { launchDev, root } from '../scripts/lib/launch.mjs';

const evidence = join(root, 'qa', 'evidence');
const dataDir = join(root, 'qa', 'data', 'typing');
const out = join(evidence, 'typing.json');

mkdirSync(evidence, { recursive: true });
rmSync(out, { force: true });
rmSync(dataDir, { recursive: true, force: true });
const app = launchDev({ args: [`--qa-typing=${out}`], dataDir, timeoutMs: 120_000 });
await app.exited;
rmSync(dataDir, { recursive: true, force: true });

const report = JSON.parse(readFileSync(out, 'utf8'));
const line = (name, s) => `${name.padEnd(22)} p50 ${s.p50} ms, p95 ${s.p95} ms, max ${s.max} ms over ${s.samples} keys`;
console.log(`display ${report.display.hz} Hz at ${report.display.scale}x`);
console.log(line('empty document', report.emptyDraft));
console.log(line('20,000 characters', report.longDraft));
console.log(`palette open           p50 ${report.paletteOpen.p50} ms, max ${report.paletteOpen.max} ms over ${report.paletteOpen.samples} opens`);
if (!report.passed) {
  console.error(`typing gate FAILED: ${JSON.stringify(report.gate)}`);
  process.exit(1);
}
console.log('typing gate passed');
