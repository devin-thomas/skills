// The adapter against the stand-in tool: the capabilities question, a job's
// outcomes, every protocol fault, cancellation and a hostile tool (premium-bar
// rules 58, 59, 60 and 65). Runs the same on Windows, macOS and Linux.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { createAdapter } from '../electron/tool/adapter.ts';
import type { Limits } from '../electron/tool/adapter.ts';
import type { ToolEvent } from '../electron/tool/progress.ts';
import { sandbox, stagingFolders, waitFor } from './helpers.ts';

function setup(t: TestContext, config: Record<string, unknown>, limits: Partial<Limits> = {}) {
  const box = sandbox(t, config);
  fs.mkdirSync(box.dataDir, { recursive: true });
  const adapter = createAdapter({ located: box.located, cwd: box.dataDir, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, limits: { graceMs: 500, ...limits } });
  return { box, adapter, output: path.join(box.dir, 'out', 'example.txt') };
}

test('capabilities: a good answer is ready', async (t) => {
  const { adapter } = setup(t, {});
  const answer = await adapter.capabilities();
  assert.ok(answer.ok);
  assert.equal(answer.capabilities.tool, 'example-tool');
});

for (const [scenario, code] of [
  ['capabilities-wrong-schema', 'TOOL_INCOMPATIBLE'],
  ['capabilities-events-2', 'TOOL_INCOMPATIBLE'],
  ['capabilities-garbage', 'TOOL_INCOMPATIBLE'],
  ['capabilities-silent', 'TOOL_STALLED'],
] as const) {
  test(`capabilities: ${scenario} is ${code}`, async (t) => {
    const { adapter } = setup(t, { capabilities: scenario }, { capabilitiesMs: 800 });
    const answer = await adapter.capabilities();
    assert.ok(!answer.ok);
    assert.equal(answer.error.code, code);
  });
}

test('a job runs, reports its events in order and publishes the file in one step', async (t) => {
  const { box, adapter, output } = setup(t, {});
  fs.mkdirSync(path.dirname(output));
  const events: ToolEvent[] = [];
  const outcome = await adapter.run(['-o', output], { onEvent: (e) => events.push(e) });
  assert.equal(outcome.status, 'ok');
  assert.deepEqual(events.map((e) => e.seq), events.map((_, i) => i));
  assert.equal(events[0]?.type, 'hello');
  assert.equal(events.at(-1)?.type, 'result');
  assert.equal(fs.readFileSync(output, 'utf8'), 'example output\n');
  assert.deepEqual(stagingFolders(path.dirname(output)), []);
  assert.equal(box.starts()[0]?.['runAsNode'], false, 'ELECTRON_RUN_AS_NODE never reaches the tool');
});

test('unknown events and fields are ignored', async (t) => {
  const { adapter, output } = setup(t, { run: 'run-unknown-events' });
  fs.mkdirSync(path.dirname(output));
  const outcome = await adapter.run(['-o', output]);
  assert.equal(outcome.status, 'ok');
});

test("every code in the contract's table reaches the shell unchanged, and a code from a newer tool too", async (t) => {
  for (const [scenario, code] of [['run-error-OUTPUT_IN_USE', 'OUTPUT_IN_USE'], ['run-error-INTERNAL', 'INTERNAL'], ['run-error-FUTURE_CODE', 'SOMETHING_NEW']]) {
    const { adapter, output } = setup(t, { run: scenario });
    const outcome = await adapter.run(['-o', output]);
    assert.ok(outcome.status === 'failed');
    assert.equal(outcome.error.code, code);
  }
});

for (const [scenario, code, limits] of [
  ['crash-no-terminal', 'TOOL_CRASHED', {}],
  ['garbage-stdout', 'TOOL_PROTOCOL', {}],
  ['hello-other-major', 'TOOL_INCOMPATIBLE', {}],
  ['seq-gap', 'TOOL_PROTOCOL', {}],
  ['line-2mib', 'TOOL_PROTOCOL', {}],
  ['noise-10mb', 'TOOL_PROTOCOL', { maxTotalBytes: 4 * 1024 * 1024 }],
  ['silence-before-hello', 'TOOL_STALLED', { helloMs: 400 }],
] as [string, string, Partial<Limits>][]) {
  test(`a hostile tool (${scenario}) ends in ${code} and leaves no process`, async (t) => {
    const { box, adapter, output } = setup(t, { run: scenario }, limits);
    const before = process.memoryUsage().rss;
    const outcome = await adapter.run(['-o', output]);
    assert.ok(outcome.status === 'failed');
    assert.equal(outcome.error.code, code);
    assert.equal(await waitFor(() => box.alive().length === 0, 3000), true, `still alive: ${box.alive().join(', ')}`);
    assert.ok(process.memoryUsage().rss - before < 64 * 1024 * 1024, 'the adapter did not hold the noise');
  });
}

test('a job that goes quiet is reported as stalled and recovers, but is never killed by the adapter', async (t) => {
  const { adapter, output } = setup(t, { run: 'silence-mid-job' }, { stallMs: 300 });
  const seen: boolean[] = [];
  const outcome = await adapter.run(['-o', output], { onStall: (s) => seen.push(s) });
  assert.equal(outcome.status, 'ok');
  assert.deepEqual(seen, [true, false]);
});

test('cancel closes stdin; the tool stops, removes its staging folder and says cancelled within 2 s', async (t) => {
  const { box, adapter, output } = setup(t, { run: 'run-slow' });
  fs.mkdirSync(path.dirname(output));
  const abort = new AbortController();
  let at = 0;
  const done = adapter.run(['-o', output], {
    signal: abort.signal,
    onEvent: (e) => {
      if (e.type === 'progress' && Number(e.done) >= 10 && !at) {
        at = Date.now();
        abort.abort();
      }
    },
  });
  const outcome = await done;
  assert.equal(outcome.status, 'cancelled');
  assert.ok(Date.now() - at < 2000, `took ${Date.now() - at} ms`);
  assert.equal(fs.existsSync(output), false, 'no output');
  assert.deepEqual(stagingFolders(path.dirname(output)), [], 'no staging folder');
  assert.equal(await waitFor(() => box.alive().length === 0, 2000), true);
});

test('a tool that ignores the cancel is killed after the grace period', async (t) => {
  const { box, adapter, output } = setup(t, { run: 'cancel-ignored' }, { graceMs: 400 });
  fs.mkdirSync(path.dirname(output));
  const abort = new AbortController();
  setTimeout(() => abort.abort(), 300);
  const started = Date.now();
  const outcome = await adapter.run(['-o', output], { signal: abort.signal });
  assert.equal(outcome.status, 'cancelled');
  assert.ok(Date.now() - started < 3000);
  assert.equal(await waitFor(() => box.alive().length === 0, 2000), true);
});
