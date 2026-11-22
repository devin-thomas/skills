#!/usr/bin/env node
// A stand-in for the example tool (docs/TOOL-CONTRACT.md), for the tests and for
// running the shell without a built tool (STANDIN_TOOL in electron/tool/index.ts).
// It takes the contract's flags and replays a scenario: a list of steps and an
// exit code. Copy it for a real tool and keep the step kinds; add recordings of
// the real tool's runs as scenarios once it exists.
//
//   node standin-tool.ts [--standin-config=FILE] <the contract's flags>
//
// A scenario is test/scenarios/NAME.json: { "steps": [...], "exit": N, "cancel": "honour" | "ignore" }.
// A step is one of:
//   { "delay_ms": N }                         wait
//   { "event": {...} }                        one event; seq, t_ms and pid are filled in
//   { "event": {...}, "verbatim": true }      exactly as written
//   { "json": {...} }                         one JSON document and a newline (capabilities)
//   { "raw": "text" }                         bytes as written
//   { "noise_bytes": N, "newline_every": M }  N bytes of rubbish
//   { "line_bytes": N }                       one valid event padded to N bytes
//   { "stderr": "text" }
//   { "stage": "working", "staging": true }   make the staging folder beside -o and report it
//   { "publish": true }                       put the staged file in place under the -o name
//   { "grandchild_ms": N }                    start a process that would outlive a kill of this one
//   { "exit": N }                             leave now with this status
//
// Configuration (a JSON file named by --standin-config or STANDIN_CONFIG):
//   capabilities, run   scenario for each kind of call (defaults: capabilities-ok, run-ok)
//   speed               divide every delay by this
//   log                 append one JSON line per start ({ pid, argv }) to this file
//   max_life_ms         leave after this long whatever happens (default 120000)
//
// Like the tool, it treats stdin end-of-file or a line `cancel` as a cancel
// request when --stdin-control is given, and never reads stdin otherwise.
//
// Two lessons from build 2 are built in. It leaves from its write callback, so
// its last line is flushed before it exits (a stand-in that called exit after
// write lost the terminal event on Windows pipes). And it exits quietly when its
// reader goes away, as the real tool must.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** One step of a scenario (see above). */
interface Step {
  delay_ms?: number;
  event?: Record<string, unknown>;
  verbatim?: boolean;
  json?: unknown;
  raw?: string;
  noise_bytes?: number;
  newline_every?: number;
  line_bytes?: number;
  stderr?: string;
  stage?: string;
  staging?: boolean;
  publish?: boolean;
  grandchild_ms?: number;
  exit?: number;
}
interface Scenario {
  steps?: Step[];
  exit?: number;
  cancel?: 'honour' | 'ignore';
}
interface Config {
  capabilities?: string;
  run?: string;
  speed?: number;
  log?: string;
  max_life_ms?: number;
}
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const started = Date.now();
const argv = process.argv.slice(2);

let configFile = process.env['STANDIN_CONFIG'] || null;
const rest: string[] = [];
for (const a of argv) {
  if (a.startsWith('--standin-config=')) configFile = a.slice('--standin-config='.length);
  else rest.push(a);
}
let config: Config = {};
if (configFile) {
  try {
    config = JSON.parse(fs.readFileSync(configFile, 'utf8')) as Config;
  } catch (error) {
    process.stderr.write(`standin: cannot read ${configFile}: ${messageOf(error)}\n`);
    process.exit(97);
  }
}

const opts: { capabilities: boolean; events: number | null; stdinControl: boolean; output: string | null; inputs: string[] } = { capabilities: false, events: null, stdinControl: false, output: null, inputs: [] };
for (let i = 0, literal = false; i < rest.length; i++) {
  const a = rest[i] ?? '';
  if (literal) opts.inputs.push(a);
  else if (a === '--') literal = true;
  else if (a === '--capabilities') opts.capabilities = true;
  else if (a === '--events') opts.events = Number(rest[++i]);
  else if (a === '--stdin-control') opts.stdinControl = true;
  else if (a === '-o') opts.output = rest[++i] ?? null;
  else opts.inputs.push(a);
}

if (config.log) {
  try {
    fs.appendFileSync(config.log, `${JSON.stringify({ pid: process.pid, argv: rest, runAsNode: 'ELECTRON_RUN_AS_NODE' in process.env, at: started })}\n`);
  } catch {
    // The log is for tests.
  }
}

setTimeout(() => process.exit(98), config.max_life_ms ?? 120_000).unref();
process.stdout.on('error', () => process.exit(0)); // the reader went away

const write = (stream: NodeJS.WriteStream, data: string | Buffer) => new Promise<void>((resolve) => stream.write(data, () => resolve()));
async function leave(code: number): Promise<void> {
  await write(process.stdout, '');
  process.exit(code);
}

const name = opts.capabilities ? (config.capabilities ?? 'capabilities-ok') : (config.run ?? 'run-ok');
const file = path.isAbsolute(name) ? name : path.join(import.meta.dirname, 'scenarios', `${name}.json`);
let scenario: Scenario = {};
try {
  scenario = JSON.parse(fs.readFileSync(file, 'utf8')) as Scenario;
} catch (error) {
  process.stderr.write(`standin: no scenario ${file}: ${messageOf(error)}\n`);
  process.exit(96);
}
const speed = config.speed ?? 1;

let seq = 0;
let staging: string | null = null;
let finished = false;

const event = (body: Record<string, unknown>) => `${JSON.stringify({ ...body, seq: seq++, t_ms: Date.now() - started, ...(body.type === 'hello' ? { pid: process.pid } : {}) })}\n`;

function cleanUp() {
  if (staging) fs.rmSync(staging, { recursive: true, force: true });
  staging = null;
}

// Cancel requests, as the contract describes them.
if (opts.stdinControl && scenario.cancel !== 'ignore') {
  let buffer = '';
  const cancel = async (reason: string) => {
    if (finished) return;
    finished = true;
    cleanUp();
    await write(process.stdout, event({ type: 'cancelled', reason }));
    await leave(130);
  };
  process.stdin.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    if (buffer.split('\n').some((line) => line.trim() === 'cancel')) void cancel('command');
  });
  process.stdin.on('end', () => void cancel('stdin_closed'));
  process.stdin.on('error', () => void cancel('stdin_closed'));
} else if (opts.stdinControl) {
  process.stdin.on('data', () => {});
  process.stdin.on('error', () => {});
}

async function play(): Promise<void> {
  for (const step of scenario.steps ?? []) {
    if (finished) return;
    if (step.delay_ms !== undefined) await new Promise((r) => setTimeout(r, (step.delay_ms ?? 0) / speed));
    else if (step.event) await write(process.stdout, step.verbatim ? `${JSON.stringify(step.event)}\n` : event(step.event));
    else if (step.json) await write(process.stdout, `${JSON.stringify(step.json)}\n`);
    else if (step.raw !== undefined) await write(process.stdout, step.raw);
    else if (step.noise_bytes) {
      const every = step.newline_every ?? 0;
      let left = step.noise_bytes;
      while (left > 0) {
        const size = Math.min(left, 64 * 1024);
        const chunk = Buffer.alloc(size, 0x7a);
        if (every) for (let i = every - 1; i < size; i += every) chunk[i] = 0x0a;
        await write(process.stdout, chunk);
        left -= size;
      }
    } else if (step.line_bytes) {
      const base = event({ type: 'unknown-padding', pad: '' });
      const pad = 'x'.repeat(Math.max(0, step.line_bytes - base.length));
      seq -= 1;
      await write(process.stdout, event({ type: 'unknown-padding', pad }));
    } else if (step.stderr !== undefined) await write(process.stderr, step.stderr);
    else if (step.stage) {
      const body: Record<string, unknown> = { type: 'stage', stage: step.stage };
      if (step.staging && opts.output) {
        const name = `.example-${crypto.randomBytes(16).toString('hex')}.tmp`;
        staging = path.join(path.dirname(path.resolve(opts.output)), name);
        fs.mkdirSync(staging);
        fs.writeFileSync(path.join(staging, 'output'), 'example output\n');
        body.staging = name;
      }
      await write(process.stdout, event(body));
    } else if (step.publish) {
      if (staging && opts.output) {
        fs.renameSync(path.join(staging, 'output'), path.resolve(opts.output));
        cleanUp();
      }
    } else if (step.grandchild_ms) {
      spawn(process.execPath, ['-e', `setTimeout(() => {}, ${step.grandchild_ms})`], { stdio: 'ignore', detached: false });
    } else if (step.exit !== undefined) {
      finished = true;
      await leave(step.exit);
    }
  }
  if (finished) return;
  finished = true;
  await leave(scenario.exit ?? 0);
}

void play();
