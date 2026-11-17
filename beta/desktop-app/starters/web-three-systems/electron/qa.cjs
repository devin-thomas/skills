// Test instrumentation for the development shell. main.cjs loads this file only
// when the app is not packaged and a --qa-* flag is present; the packaged app
// does not include it.
//
//   --qa-typing=<out.json>          key-event-to-frame latency while typing, short and long draft, and palette open time
//   --qa-type-then-wait=<out.json>  type a known text into the body, report the PID and last key time, then stay open
//                                   (the kill test terminates this process from outside)
//   --qa-read-body=<out.json>       report the restored body text, then quit
//   --qa-long=<n>                   with --qa-type-then-wait: start from a body of n characters
//   --qa-marks=<out.json>           launch and first-frame times, the display, and the result of --qa-bench
//   --qa-bench=<script.js>          run a scripted workload inside the page (measure/workload.js) and record what it returns
//   --qa-exit-after=<seconds>       quit after this long (the measurement harness uses it)
//
// The typing and kill tests need one text field with the id in FIELD and a saved
// document shaped by draftJson(). Change both when the app's main field changes.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIELD = 'field-body';
// The palette's modifier as the page's shortcut table reads it: Command on macOS, Control elsewhere.
const MOD = require('./platform.cjs').SYSTEM === 'macos' ? 'meta' : 'control';
/** The saved document the page restores from, holding `body` in its main text field. */
const draftJson = (title, body) => JSON.stringify({ v: 1, title, body, savedAt: Date.now() });

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const KEY_NAMES = { ' ': 'Space', '\n': 'Enter' };

/** One physical key press through Chromium's real input pipeline. */
function press(contents, ch) {
  const keyCode = KEY_NAMES[ch] ?? ch;
  contents.sendInputEvent({ type: 'keyDown', keyCode });
  contents.sendInputEvent({ type: 'char', keyCode: ch === '\n' ? '\r' : ch });
  contents.sendInputEvent({ type: 'keyUp', keyCode });
}

async function focusBody(win) {
  win.webContents.focus();
  await win.webContents.executeJavaScript(`(() => {
    const el = document.getElementById('${FIELD}');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    return document.activeElement === el;
  })()`);
}

const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  const round = (n) => Math.round(n * 10) / 10;
  return sorted.length ? { samples: sorted.length, p50: round(at(0.5)), p95: round(at(0.95)), max: round(sorted[sorted.length - 1]) } : { samples: 0 };
};

// In the page: for each key, the time from the key event's own timestamp to the
// end of the frame in which the resulting text change was rendered.
const PROBE = `(() => {
  window.__lat = [];
  window.__slow = [];
  let keyAt = null;
  const el = document.getElementById('${FIELD}');
  el.addEventListener('keydown', (e) => { keyAt = e.timeStamp; }, true);
  el.addEventListener('input', () => {
    const t0 = keyAt;
    if (t0 === null) return;
    keyAt = null;
    requestAnimationFrame(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => window.__lat.push(performance.now() - t0);
      channel.port2.postMessage(0);
    });
  }, true);
  // The browser's own measure of event start to next paint, for interactions of 16 ms or more.
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (entry.name === 'keydown' || entry.name === 'keypress' || entry.name === 'input') window.__slow.push(entry.duration);
  }).observe({ type: 'event', durationThreshold: 16, buffered: false });
  return true;
})()`;

async function typeRun(win, text, gapMs) {
  await win.webContents.executeJavaScript('window.__lat = []; window.__slow = []; true');
  for (const ch of text) {
    press(win.webContents, ch);
    await sleep(gapMs);
  }
  await sleep(400);
  return win.webContents.executeJavaScript(`({ lat: window.__lat, slow: window.__slow, length: document.getElementById("${FIELD}").value.length })`);
}

function sampleText(count) {
  const words = 'the quick brown fox jumps over the lazy dog while the mix is rendering and nobody is watching the meters'.split(' ');
  let out = '';
  for (let i = 0; out.length < count; i++) out += (i % 14 === 13 ? '\n' : '') + words[i % words.length] + ' ';
  return out.slice(0, count);
}

async function typingScenario(win, outFile, writeState, options) {
  const report = { at: new Date().toISOString(), display: null, window: win.getBounds(), visible: win.isVisible(), note: 'Times run from the key event timestamp to the end of the frame that rendered the change, on the page clock. They do not include the compositor or the display.' };
  const { screen } = require('electron');
  const display = screen.getDisplayMatching(win.getBounds());
  report.display = { hz: display.displayFrequency, scale: display.scaleFactor };

  await sleep(800);
  await focusBody(win);
  await win.webContents.executeJavaScript(PROBE);
  const short = await typeRun(win, sampleText(220), 35);
  report.emptyDraft = { ...stats(short.lat), typed: 220, bodyLengthAfter: short.length, interactionsOver16ms: short.slow.length, worstEventTimingMs: short.slow.length ? Math.max(...short.slow) : 0 };

  // Palette: Ctrl+K key event to the frame that shows it.
  const palette = [];
  for (let i = 0; i < 6; i++) {
    await win.webContents.executeJavaScript(`(() => {
      window.__palette = null;
      window.addEventListener('keydown', function once(e) {
        if (e.key.toLowerCase() !== 'k' || !e.ctrlKey) return;
        window.removeEventListener('keydown', once, true);
        const t0 = e.timeStamp;
        const look = () => {
          if (document.querySelector('.palette')) {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => { window.__palette = performance.now() - t0; };
            channel.port2.postMessage(0);
          } else requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      }, true);
      return true;
    })()`);
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'K', modifiers: [MOD] });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'K', modifiers: [MOD] });
    await sleep(300);
    const value = await win.webContents.executeJavaScript('window.__palette');
    if (typeof value === 'number') palette.push(value);
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await sleep(250);
  }
  report.paletteOpen = stats(palette);

  // Long draft: restart the page with about 20,000 characters already in the body.
  const long = sampleText(20000);
  writeState(options.draftKey, draftJson('Long draft', long));
  win.webContents.reload();
  await new Promise((r) => win.webContents.once('did-finish-load', r));
  await sleep(800);
  await focusBody(win);
  await win.webContents.executeJavaScript(PROBE);
  const longRun = await typeRun(win, sampleText(220), 35);
  report.longDraft = { ...stats(longRun.lat), typed: 220, bodyLengthAfter: longRun.length, interactionsOver16ms: longRun.slow.length, worstEventTimingMs: longRun.slow.length ? Math.max(...longRun.slow) : 0 };

  const gate = (s) => s.samples >= 200 && s.p95 <= 50 && s.max <= 100;
  report.gate = {
    typingEmpty: gate(report.emptyDraft),
    typingLong: gate(report.longDraft),
    paletteWithin50ms: report.paletteOpen.samples > 0 && report.paletteOpen.max <= 50,
  };
  report.passed = Object.values(report.gate).every(Boolean);
  fs.writeFileSync(path.resolve(outFile), JSON.stringify(report, null, 2));
}

async function typeThenWait(win, outFile, writeState, options) {
  const longCount = Number(arg('qa-long') ?? 0);
  if (longCount > 0) {
    writeState(options.draftKey, draftJson('Kill test', sampleText(longCount)));
    win.webContents.reload();
    await new Promise((r) => win.webContents.once('did-finish-load', r));
  }
  await sleep(800);
  await focusBody(win);
  const before = await win.webContents.executeJavaScript(`document.getElementById("${FIELD}").value`);
  const text = `Kill test ${Date.now()}: this sentence must survive the process being terminated. `;
  for (const ch of text) {
    press(win.webContents, ch);
    await sleep(25);
  }
  fs.writeFileSync(path.resolve(outFile), JSON.stringify({ pid: process.pid, expected: before + text, typed: text, lastKeyAt: Date.now() }));
}

async function readBody(win, outFile) {
  await sleep(600);
  const state = await win.webContents.executeJavaScript(`({ body: document.getElementById("${FIELD}").value })`);
  fs.writeFileSync(path.resolve(outFile), JSON.stringify(state));
  win.close();
}

// Launch-to-first-frame marks and an optional scripted workload, for measure/run.py.
async function marksScenario(win, outFile, options) {
  const { app, screen } = require('electron');
  const display = screen.getDisplayMatching(win.getBounds());
  const marks = { pid: process.pid, launchedAt: options.launchedAt, didFinishLoad: Date.now(), display: { hz: display.displayFrequency, scale: display.scaleFactor, primary: display.id === screen.getPrimaryDisplay().id } };
  const flush = () => fs.writeFileSync(path.resolve(outFile), JSON.stringify({ pid: process.pid, marks }, null, 2));
  const exitAfter = Number(arg('qa-exit-after') ?? 0);
  if (exitAfter > 0) setTimeout(() => { flush(); app.quit(); }, exitAfter * 1000);
  try {
    marks.paint = await win.webContents.executeJavaScript(
      `new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r({ fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || null, timeOrigin: performance.timeOrigin, now: performance.now() }))))`,
    );
    marks.firstFrameAfterLoad = marks.paint.timeOrigin + marks.paint.now;
  } catch (error) {
    marks.paintError = String(error);
  }
  flush();
  const bench = arg('qa-bench');
  if (bench) {
    try {
      marks.bench = await win.webContents.executeJavaScript(fs.readFileSync(path.resolve(bench), 'utf8'));
    } catch (error) {
      marks.benchError = String(error);
    }
    flush();
  }
}

/** @param {import('electron').BrowserWindow} win */
async function run(win, writeState, options) {
  const marks = arg('qa-marks');
  if (marks) return marksScenario(win, marks, options);
  const typing = arg('qa-typing');
  const typeWait = arg('qa-type-then-wait');
  const read = arg('qa-read-body');
  if (typing) {
    await typingScenario(win, typing, writeState, options);
    win.close();
  } else if (typeWait) await typeThenWait(win, typeWait, writeState, options);
  else if (read) await readBody(win, read);
}

module.exports = { run };
