// Scripted workload run inside the page by --qa-bench. No OS input is sent.
// Phases: list scroll (10 s), typing in the main text field (4 s), command palette (2.4 s).
// It waits 30 s first so the harness can take its launch and idle readings.
// The selectors match the starter screen; change them with the app's first screen.
//
// JavaScript on purpose: the file's text is the expression the page evaluates (electron/qa.ts
// reads it and passes it to executeJavaScript, and measure/run.py names this file), so it cannot
// be a module or need a build. Its types are checked with the page's (tsconfig.json, checkJs).
(async () => {
  /** @param {number} ms */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** @returns {Promise<number>} */
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  /** @param {HTMLInputElement | HTMLTextAreaElement} el @param {string} value */
  const setValue = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  /** @param {string} name @param {number[]} gaps */
  const stats = (name, gaps) => {
    const s = gaps.slice().sort((a, b) => a - b);
    /** @param {number} p */
    const at = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
    const period = s.length ? at(50) : 0;
    return { name, frames: s.length, p50: +at(50).toFixed(2), p99: +at(99).toFixed(2), max: +(s[s.length - 1] ?? 0).toFixed(2), late: s.filter((g) => g > 1.5 * period).length };
  };
  /** @param {string} name @param {number} ms @param {(t: number) => void} step */
  const timed = async (name, ms, step) => {
    /** @type {number[]} */
    const gaps = []; let last = performance.now(); const end = last + ms;
    while (performance.now() < end) { const t = await frame(); gaps.push(t - last); last = t; step(t); }
    return stats(name, gaps);
  };
  /** @type {string[]} */
  const notes = [];
  /** @type {ReturnType<typeof stats>[]} */
  const phases = [];
  await sleep(30000);
  const t0 = Date.now();

  // 1. scroll the longest list on the page
  const scroller = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight * 20 && getComputedStyle(e).overflowY !== 'visible').sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  if (scroller) {
    notes.push('list scrollHeight ' + scroller.scrollHeight);
    let dir = 1;
    phases.push(await timed('list-scroll', 10000, () => {
      scroller.scrollTop += 28 * dir;
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2 || scroller.scrollTop <= 0) dir = -dir;
    }));
    notes.push('rows in DOM ' + scroller.querySelectorAll('[role="option"],li,[data-row]').length);
  } else notes.push('no list scroller');

  // 2. change the main text field every other frame (so the display presents at half its rate here)
  const body = document.getElementById('field-body');
  const text = 'The second section still needs a decision before Thursday, and the list has to hold ten thousand rows. ';
  if (body instanceof HTMLInputElement || body instanceof HTMLTextAreaElement) {
    let i = 0;
    phases.push(await timed('typing', 4000, () => { i += 1; if (i % 2 === 0) setValue(body, body.value + text[(i / 2) % text.length]); }));
  } else notes.push('no body field');

  // 3. command palette open and close
  let pal = 0; let next = 0;
  phases.push(await timed('command-palette', 2400, (t) => {
    if (t < next) return;
    next = t + 600; pal += 1;
    const open = pal % 2 === 1;
    const target = open ? window : (document.activeElement ?? document);
    target.dispatchEvent(new KeyboardEvent('keydown', { key: open ? 'k' : 'Escape', code: open ? 'KeyK' : 'Escape', ctrlKey: open, bubbles: true }));
  }));
  (document.activeElement ?? document).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
  return { seconds: (Date.now() - t0) / 1000, phases, notes };
})()
