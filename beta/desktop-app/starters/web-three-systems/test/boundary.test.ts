// The permission decision of electron/boundary.ts, without Electron.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED, permissionDecision } from '../electron/boundary.ts';

const ORIGIN = 'app://local';

test('the starter allows exactly one permission, with a reason', () => {
  assert.deepEqual(Object.keys(ALLOWED), ['clipboard-sanitized-write']);
  for (const why of Object.values(ALLOWED)) assert.ok(why.length > 20);
});

test('the allowed permission is granted to the app origin only', () => {
  assert.equal(permissionDecision('clipboard-sanitized-write', 'app://local/index.html', ORIGIN), true);
  assert.equal(permissionDecision('clipboard-sanitized-write', 'app://local', ORIGIN), true);
  for (const url of ['https://example.com/', 'app://localhost/index.html', 'file:///index.html', '', undefined, null]) {
    assert.equal(permissionDecision('clipboard-sanitized-write', url, ORIGIN), false, String(url));
  }
});

test('everything else is denied, even to the app origin', () => {
  const others = ['media', 'camera', 'microphone', 'geolocation', 'notifications', 'midi', 'midiSysex', 'pointerLock', 'fullscreen', 'openExternal', 'clipboard-read', 'hid', 'serial', 'usb', 'display-capture', 'idle-detection', 'window-management', 'storage-access', 'fileSystem', 'unknown'];
  for (const permission of others) assert.equal(permissionDecision(permission, 'app://local/index.html', ORIGIN), false, permission);
});

test('a permission name that is an Object.prototype key is denied', () => {
  for (const permission of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(permissionDecision(permission, 'app://local/index.html', ORIGIN), false, permission);
});
