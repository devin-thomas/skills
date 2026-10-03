import assert from 'node:assert/strict';
import test from 'node:test';
import { createSkillsCapabilityRegistry } from '../../dist/agent-native/index.js';

test('Agent Native authorization denial happens before the operation handler', async () => {
  let invoked = false;
  const context = {
    scope: { host: 'test', kind: 'project' },
    caller: { kind: 'authenticated', subject: 'test', scopes: [] },
    authorization: { authorize: () => false },
    sourcePolicy: {},
    nativeRegistration: {},
    operations: { 'installation.remove': () => { invoked = true; return { removed: true }; } },
  };
  const handle = createSkillsCapabilityRegistry(context, ['installation.remove']);
  const result = await handle.execute('installation.remove', { ids: ['quick-build'] });
  assert.equal(result.kind, 'failure');
  assert.equal(result.reason, 'unauthorized');
  assert.equal(invoked, false);
});

test('Agent Native rejects malformed capability inputs before invoking handlers', async () => {
  let invoked = false;
  const context = {
    scope: { host: 'test', kind: 'project' },
    caller: { kind: 'authenticated', subject: 'test', scopes: ['skills:write'] },
    authorization: { authorize: () => true },
    sourcePolicy: {},
    nativeRegistration: {},
    operations: { 'installation.add': () => { invoked = true; return { installed: true }; } },
  };
  const handle = createSkillsCapabilityRegistry(context, ['installation.add']);
  const result = await handle.execute('installation.add', { ids: [] });
  assert.equal(result.kind, 'failure');
  assert.equal(result.reason, 'invalid-input');
  assert.equal(invoked, false);
});
