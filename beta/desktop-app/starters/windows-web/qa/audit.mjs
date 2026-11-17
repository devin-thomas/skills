// Audits the production build headlessly and writes qa/audit.json.
// Exits 1 with the failures printed when any gate fails.
//
// Gates (the premium-bar rule each one checks is in brackets):
//   css        no `transition: all`, no animated layout property, nothing over 300 ms
//              except a sheet (450 ms), read from the shipped stylesheets [13, 14, 15]
//   motion     the same limits on animations that actually ran; popovers grow from their
//              trigger; no motion for keyboard actions; no transform motion under
//              prefers-reduced-motion [13, 15, 18, 20, 22]
//   list       DOM rows in the 10,000-row list stay near the visible count [26]
//   axe        zero violations in both themes, every state [37]
//   focus      every keyboard-focusable element changes appearance on focus [5]
//   names      every interactive element has an accessible name [36]
//   text       no text under 12 px [31]
//   language   no banned term (qa/banned-terms.json) in text a person reads [49]
//   clipped    a scroll area that hides content shows a fading edge or a scrollbar [38]
//   overflow   no horizontal overflow at 1024 px wide, 125% scale or 200% zoom [38]
//   restore    unsaved work survives a reload and corrupt storage [44, page level only]
//   journeys   each journey in qa/journeys.json runs by keyboard alone within its step budget [6, 47]
//   shortcuts  every command is in the palette with its shortcut, tooltips show shortcuts,
//              and each shortcut works [46]
//
// The states, the journey scripts and the shortcut effects below describe the
// starter screen. Rewrite those three blocks for the app; the gates stay.
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fill, launch, load, openPage, park, root, serve, settle } from './lib.mjs';

const config = JSON.parse(readFileSync(join(root, 'app.config.json'), 'utf8'));
const journeys = JSON.parse(readFileSync(join(root, 'qa', 'journeys.json'), 'utf8')).journeys;
const bannedTerms = JSON.parse(readFileSync(join(root, 'qa', 'banned-terms.json'), 'utf8')).terms;
const DRAFT_KEY = `${config.storagePrefix}.draft.v1`;

const failures = [];
const report = { generatedFor: 'dist/', gates: {} };
const fail = (gate, message) => failures.push(`[${gate}] ${message}`);

const { url, close } = await serve();
const { browser, channel } = await launch();
report.browser = { channel, version: browser.version() };

// ---------------------------------------------------------------- states ---

const openPalette = async (page) => {
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.palette');
};

// The shortcut shows the list first, which matters when the window is too narrow to dock it.
const filterItems = async (page, text) => {
  await page.keyboard.press('Control+Shift+R');
  await page.waitForFunction(() => document.activeElement?.id === 'rail-filter');
  await page.keyboard.type(text);
};

const STATES = {
  empty: async () => {},
  filled: async (page) => fill(page),
  filtered: async (page) => {
    await fill(page);
    await filterItems(page, 'cedar');
  },
  'no-match': async (page) => filterItems(page, 'zzq'),
  palette: async (page) => {
    await fill(page);
    await openPalette(page);
  },
  'palette-no-match': async (page) => {
    await openPalette(page);
    await page.keyboard.type('zzq');
  },
  about: async (page) => {
    await openPalette(page);
    await page.keyboard.type('about');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.dialog');
  },
  toast: async (page) => {
    await fill(page);
    await page.click('#action-clear');
    await page.waitForSelector('.toast');
  },
};

async function inState(name, options, run) {
  const { context, page, errors } = await openPage(browser, options);
  try {
    await load(page, url);
    await STATES[name](page);
    await park(page);
    await settle(page);
    return await run(page);
  } finally {
    if (errors.length) fail('page', `${name}: ${errors.join(' | ')}`);
    await context.close();
  }
}

// ------------------------------------------------------------------ css ---

const LAYOUT = [
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'top', 'right', 'bottom', 'left', 'inset',
  'margin', 'padding', 'border-width', 'font-size', 'line-height', 'flex-basis', 'gap', 'grid-template-columns',
];

async function cssGate() {
  const { context, page } = await openPage(browser, { width: 1280, height: 800 });
  await load(page, url);
  const rules = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const resolve = (text) => {
      let out = text;
      for (let i = 0; i < 6 && out.includes('var('); i++) {
        out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,[^()]*)?\)/g, (_, name) => rootStyle.getPropertyValue(name).trim() || '0s');
      }
      return out;
    };
    const found = [];
    const walk = (list, prefix) => {
      for (const rule of list) {
        const selector = rule.selectorText ? rule.selectorText.replaceAll('&', prefix || '') : prefix;
        if (rule.style) {
          const loops = rule.style.getPropertyValue('animation-iteration-count') === 'infinite';
          for (const name of ['transition', 'transition-property', 'transition-duration', 'animation', 'animation-duration']) {
            const value = rule.style.getPropertyValue(name);
            if (value) found.push({ selector: selector || rule.cssText.slice(0, 40), name, raw: value, value: resolve(value), loops });
          }
        }
        if (rule.cssRules?.length) walk(rule.cssRules, selector);
      }
    };
    for (const sheet of document.styleSheets) walk(sheet.cssRules, '');
    return found;
  });
  await context.close();

  const splitTop = (text) => {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of text) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  };
  const toMs = (token) => (token.endsWith('ms') ? parseFloat(token) : parseFloat(token) * 1000);
  const times = (segment) => (segment.replace(/\([^()]*\)/g, '').match(/(?<![\w.-])\d*\.?\d+m?s\b/g) ?? []).map(toMs);

  let longest = 0;
  let longestSheet = 0;
  let violations = [];
  const real = rules.length;
  // Three planted rules prove the classifier works; they are removed again below.
  rules.push(
    { selector: '.planted-a', name: 'transition', raw: 'all 1s', value: 'all 1s' },
    { selector: '.planted-b', name: 'transition', raw: 'height .2s', value: 'height .2s' },
    { selector: '.planted-c', name: 'animation-duration', raw: '.5s', value: '.5s' },
  );
  for (const rule of rules) {
    const isSheet = /\.sheet\b/.test(rule.selector);
    const segments = splitTop(rule.value);
    if (rule.name === 'transition' || rule.name === 'transition-property') {
      for (const segment of segments) {
        const property = segment.split(/\s+/)[0];
        if (property === 'all') violations.push(`${rule.selector} { ${rule.name}: ${rule.raw} } uses "all"`);
        if (LAYOUT.some((p) => property === p || property.startsWith(`${p}-`))) {
          violations.push(`${rule.selector} animates layout property ${property}`);
        }
      }
    }
    if (rule.name === 'transition-property') continue;
    const infinite = rule.loops || /\binfinite\b/.test(rule.value);
    for (const segment of segments) {
      const all = times(segment);
      const duration = rule.name.endsWith('duration') ? Math.max(0, ...all) : (all[0] ?? 0);
      if (infinite) continue; // spinner loop, reported under motion
      if (!rule.selector.startsWith('.planted-')) {
        if (isSheet) longestSheet = Math.max(longestSheet, duration);
        else longest = Math.max(longest, duration);
      }
      if (duration > (isSheet ? 450 : 300)) {
        violations.push(`${rule.selector} { ${rule.name}: ${rule.raw} } runs ${duration} ms`);
      }
    }
  }
  const planted = violations.filter((v) => v.includes('.planted-'));
  if (planted.length !== 4) fail('audit', `css self-test caught ${planted.length} of 4 planted violations`);
  violations = violations.filter((v) => !v.includes('.planted-'));
  report.gates.css = {
    selfTest: `${planted.length} of 4 planted violations caught`,
    declarationsRead: real,
    longestMs: longest,
    longestSheetMs: longestSheet,
    violations,
  };
  violations.forEach((v) => fail('css', v));
}

// --------------------------------------------------------------- motion ---

const RECORDER = () => {
  window.__seen = new WeakSet();
  window.__motion = [];
  const describe = (el) => {
    if (!el) return 'unknown';
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
  };
  const tick = () => {
    for (const animation of document.getAnimations()) {
      if (window.__seen.has(animation)) continue;
      window.__seen.add(animation);
      const effect = animation.effect;
      const timing = effect?.getComputedTiming?.() ?? {};
      const target = effect?.target ?? null;
      let properties = [];
      try {
        properties = [...new Set(effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter(
          (k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k),
        );
      } catch {
        properties = [];
      }
      window.__motion.push({
        kind: animation.constructor.name,
        name: animation.transitionProperty ?? animation.animationName ?? 'script',
        properties,
        duration: Number(timing.duration) || 0,
        iterations: timing.iterations === Infinity ? 'infinite' : timing.iterations,
        target: describe(target),
        inSheet: Boolean(target?.closest?.('.sheet')),
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const drain = (page) =>
  page.evaluate(() => {
    const out = window.__motion;
    window.__motion = [];
    return out;
  });

const LAYOUT_JS = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding', 'fontSize', 'inset'];
// Endless animations that are allowed: the spinner, and the scroll-driven fade at the end of a scroll area.
const ENDLESS_OK = ['spin', 'scroll-cue'];

function judge(records, label) {
  const violations = [];
  for (const r of records) {
    const props = r.properties.length ? r.properties : [r.name];
    if (r.iterations === 'infinite' || ENDLESS_OK.includes(r.name)) {
      if (!ENDLESS_OK.includes(r.name)) violations.push(`${label}: endless animation ${r.name} on ${r.target}`);
      continue;
    }
    const limit = r.inSheet ? 450 : 300;
    if (r.duration > limit) violations.push(`${label}: ${r.name} on ${r.target} runs ${r.duration} ms (limit ${limit})`);
    for (const p of props) {
      if (LAYOUT_JS.some((l) => p === l || p.startsWith(l))) violations.push(`${label}: layout property ${p} animates on ${r.target}`);
    }
  }
  return violations;
}

async function motionGate() {
  const out = { pointer: {}, keyboard: {}, reducedMotion: {} };
  const themeButton = '[aria-label="Use the dark theme"], [aria-label="Use the light theme"]';

  // Pointer session: everything a mouse user triggers.
  {
    const { context, page } = await openPage(browser, { width: 1280, height: 800 });
    await page.addInitScript(RECORDER);
    await load(page, url);
    await fill(page);
    await drain(page);
    const steps = [
      ['hover and press a button', async () => {
        await page.hover('#action-clear');
        await page.mouse.down();
        await page.waitForTimeout(160);
        await page.mouse.move(300, 4);
        await page.mouse.up();
        await page.waitForTimeout(250);
      }],
      ['tooltip', async () => {
        await page.hover(themeButton);
        await page.waitForTimeout(800);
        await page.mouse.move(300, 4);
        await page.waitForTimeout(200);
      }],
      ['clear and undo', async () => {
        await page.click('#action-clear');
        await page.waitForTimeout(350);
        await page.getByRole('button', { name: 'Undo' }).click();
        await page.waitForTimeout(450);
      }],
      ['open and close a dialog', async () => {
        await page.getByRole('button', { name: /Commands/ }).click();
        await page.waitForSelector('.palette');
        await page.getByRole('option', { name: /^About/ }).click();
        await page.waitForSelector('.dialog');
        await page.waitForTimeout(350);
        await page.getByRole('button', { name: 'Close' }).click();
        await page.waitForTimeout(350);
      }],
    ];
    for (const [label, run] of steps) {
      await run();
      const records = await drain(page);
      out.pointer[label] = records.map((r) => `${r.name} ${r.duration}ms on ${r.target}`);
      judge(records, `pointer/${label}`).forEach((v) => fail('motion', v));
    }
    await context.close();
  }

  // Popovers animate from their trigger: the origin must not be the centre.
  {
    const { context, page } = await openPage(browser, { width: 1280, height: 800 });
    await load(page, url);
    await page.hover(themeButton);
    await page.waitForSelector('.tooltip');
    const origin = await page.evaluate(() => {
      const popup = document.querySelector('.tooltip');
      const box = popup.getBoundingClientRect();
      const [x, y] = getComputedStyle(popup).transformOrigin.split(' ').map(parseFloat);
      return { x, y, width: box.width, height: box.height };
    });
    out.tooltipTransformOrigin = origin;
    const centred = Math.abs(origin.x - origin.width / 2) < 2 && Math.abs(origin.y - origin.height / 2) < 2;
    if (centred) fail('motion', 'the tooltip animates from its centre, not from its trigger');
    await context.close();
  }

  // Keyboard session: actions started from the keyboard must not animate.
  {
    const { context, page } = await openPage(browser, { width: 1280, height: 800 });
    await page.addInitScript(RECORDER);
    await load(page, url);
    await fill(page);
    await page.locator('#field-body').focus();
    await page.keyboard.press('End');
    await drain(page);
    const steps = [
      ['Ctrl+K opens the palette', async () => {
        await openPalette(page);
        await page.waitForTimeout(200);
      }],
      ['arrow keys move through commands', async () => {
        for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }],
      ['arrow keys move through the list', async () => {
        await page.getByRole('listbox', { name: 'All items' }).focus();
        for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(150);
      }],
      ['a shortcut that shows a toast', async () => {
        await page.keyboard.press('Control+Shift+D');
        await page.waitForSelector('.toast');
        await page.waitForTimeout(300);
      }],
    ];
    for (const [label, run] of steps) {
      await run();
      // Wait indicators (skeleton, spinner) are exempt: their delayed appearance is a timing rule.
      const records = (await drain(page)).filter(
        (r) => r.iterations !== 'infinite' && !ENDLESS_OK.includes(r.name) && r.duration > 0 && !/skeleton|spinner/.test(r.target),
      );
      out.keyboard[label] = records.map((r) => `${r.name} ${r.duration}ms on ${r.target}`);
      if (records.length) fail('motion', `keyboard/${label}: ${records.length} animation(s) ran: ${out.keyboard[label].join(', ')}`);
    }
    await context.close();
  }

  // Reduced motion: opacity may fade; transforms must not animate.
  {
    const { context, page } = await openPage(browser, { width: 1280, height: 800, reducedMotion: 'reduce' });
    await page.addInitScript(RECORDER);
    await load(page, url);
    await fill(page);
    await drain(page);
    await page.hover(themeButton);
    await page.waitForTimeout(700);
    await page.click('#action-clear');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Undo' }).click();
    await page.waitForTimeout(400);
    const records = (await drain(page)).filter((r) => r.duration > 0);
    out.reducedMotion.ran = records.map((r) => `${r.name} ${r.duration}ms on ${r.target}`);
    const moving = records.filter((r) => [r.name, ...r.properties].some((p) => /transform|translate|scale|rotate/.test(p)));
    moving.forEach((r) => fail('motion', `reduced motion: ${r.name} still animates on ${r.target}`));
    await context.close();
  }

  report.gates.motion = out;
}

// ----------------------------------------------------------------- list ---

async function listGate() {
  const { context, page } = await openPage(browser, { width: 1280, height: 800 });
  await load(page, url);
  const list = page.getByRole('listbox', { name: 'All items' });
  const measure = () =>
    list.evaluate((el) => ({
      domRows: el.querySelectorAll('[data-row]').length,
      visibleRows: Math.ceil(el.clientHeight / 40),
      totalRows: Number(el.querySelector('[data-row]')?.getAttribute('aria-setsize') ?? 0),
      scrollHeight: el.scrollHeight,
    }));
  const samples = { top: await measure() };
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight / 2));
  await page.waitForTimeout(150);
  samples.middle = await measure();
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.waitForTimeout(150);
  samples.end = await measure();
  await context.close();
  report.gates.list = samples;
  for (const [where, s] of Object.entries(samples)) {
    if (s.totalRows !== 10000) fail('list', `${where}: list reports ${s.totalRows} rows, expected 10000`);
    if (s.domRows > s.visibleRows + 16) fail('list', `${where}: ${s.domRows} DOM rows for ${s.visibleRows} visible`);
    if (s.domRows < s.visibleRows) fail('list', `${where}: only ${s.domRows} DOM rows for ${s.visibleRows} visible`);
  }
}

// -------------------------------------------------- per-state page checks ---

const PAGE_CHECKS = async (terms) => {
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const visible = (el) => {
    if (el.closest('[inert]')) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? '';
    return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ''} "${label}"`;
  };

  // -- text size
  const small = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let smallest = Infinity;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || !visible(el) || el.closest('script,style')) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    smallest = Math.min(smallest, size);
    if (size < 12) small.push(`${describe(el)} at ${size}px`);
  }

  // -- plain language: no banned term in text a person reads without opening Details
  const banned = [];
  if (terms.length) {
    const BANNED = new RegExp(terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
    const words = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = words.nextNode(); node; node = words.nextNode()) {
      const el = node.parentElement;
      if (!el || !visible(el) || el.closest('script,style,[data-details]')) continue;
      if (BANNED.test(node.textContent)) banned.push(`"${node.textContent.trim().slice(0, 70)}"`);
    }
    for (const el of document.querySelectorAll('[placeholder],[aria-label]')) {
      if (!visible(el) || el.closest('[data-details]')) continue;
      const text = `${el.getAttribute('placeholder') ?? ''} ${el.getAttribute('aria-label') ?? ''}`;
      if (BANNED.test(text)) banned.push(`attribute "${text.trim()}"`);
    }
  }

  // -- a scroll area that hides content must show it: a fading edge or a scrollbar
  const clipped = [];
  for (const el of document.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const style = getComputedStyle(el);
    if (!/auto|scroll/.test(style.overflowY) || el.scrollHeight <= el.clientHeight + 1) continue;
    if (el.matches('textarea')) continue; // native text scrolling
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    const hasBar = el.offsetWidth - el.clientWidth > 0;
    const hasFade = style.maskImage !== 'none' && style.maskImage !== '';
    if (!atEnd && !hasBar && !hasFade) clipped.push(`${describe(el)} hides ${el.scrollHeight - el.clientHeight}px with no cue`);
  }

  // -- accessible names and focus styles
  const interactive = [
    ...document.querySelectorAll(
      'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex], [role="option"], [role="tab"], [role="combobox"], [role="listbox"]',
    ),
  ].filter(
    (el) =>
      visible(el) &&
      !el.disabled &&
      el.getAttribute('aria-disabled') !== 'true' &&
      // Base UI's focus guards are hidden sentinels, not controls.
      !el.hasAttribute('data-base-ui-focus-guard') &&
      el.getAttribute('aria-hidden') !== 'true',
  );

  const nameOf = (el) => {
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
      if (text) return text;
    }
    const aria = el.getAttribute('aria-label');
    if (aria?.trim()) return aria.trim();
    if (el.labels?.length) return [...el.labels].map((l) => l.textContent).join(' ').trim();
    if (el.matches('input, textarea, select')) return (el.getAttribute('title') ?? el.getAttribute('placeholder') ?? '').trim();
    return (el.textContent ?? '').trim() || (el.getAttribute('title') ?? '').trim();
  };
  const unnamed = interactive
    .filter((el) => !el.matches('[tabindex="-1"]:not(button):not([role])'))
    .filter((el) => !nameOf(el))
    .map(describe);

  const signature = (el) => {
    const parts = [];
    let node = el;
    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      const s = getComputedStyle(node);
      const before = getComputedStyle(node, '::before');
      parts.push([s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.backgroundColor, s.borderTopColor, before.backgroundColor].join('|'));
    }
    const active = el.getAttribute('aria-activedescendant');
    const activeEl = active ? document.getElementById(active) : el.querySelector?.('[data-active="true"]');
    if (activeEl) {
      const s = getComputedStyle(activeEl);
      parts.push([s.outlineStyle, s.outlineWidth, s.backgroundColor].join('|'));
    }
    return parts.join('\n');
  };

  const focusable = interactive.filter((el) => el.tabIndex >= 0);
  const previous = document.activeElement;
  const noFocusStyle = [];
  const notFocusable = [];
  for (const el of focusable) {
    document.activeElement?.blur?.();
    const before = signature(el);
    el.focus({ preventScroll: true });
    if (document.activeElement !== el) {
      notFocusable.push(describe(el));
      continue;
    }
    if (signature(el) === before) {
      // Some focus styles arrive with the next render (the list picks a visible row).
      await frames();
      if (signature(el) === before) noFocusStyle.push(describe(el));
    }
  }
  previous?.focus?.({ preventScroll: true });

  // -- target size (reported, not a gate)
  const smallTargets = interactive
    .filter((el) => el.matches('button, a[href], [role="option"], [role="tab"]'))
    .filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width < 24 || box.height < 24;
    })
    .map((el) => {
      const box = el.getBoundingClientRect();
      return `${describe(el)} ${Math.round(box.width)}x${Math.round(box.height)}`;
    });

  // -- horizontal overflow
  const vw = document.documentElement.clientWidth;
  const outside = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const box = el.getBoundingClientRect();
    if (box.right > vw + 1 || box.left < -1) outside.push(`${describe(el)} spans ${Math.round(box.left)}..${Math.round(box.right)} of ${vw}`);
  }
  const action = document.querySelector('[data-primary-action], #action-clear');
  const actionBox = action?.getBoundingClientRect();
  return {
    smallestTextPx: smallest,
    smallText: small,
    banned,
    clipped,
    interactiveCount: interactive.length,
    focusableCount: focusable.length,
    unnamed,
    noFocusStyle,
    notFocusable,
    smallTargets,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: vw,
    outside: outside.slice(0, 12),
    primaryActionReachable: actionBox ? actionBox.bottom <= window.innerHeight + 1 && actionBox.right <= vw + 1 : null,
  };
};

async function stateGates() {
  const axe = {};
  let smallest = Infinity;
  let focusableChecked = 0;
  let interactiveChecked = 0;
  const targets = new Set();

  for (const theme of ['light', 'dark']) {
    for (const name of Object.keys(STATES)) {
      await inState(name, { width: 1280, height: 800, theme }, async (page) => {
        const result = await new AxeBuilder({ page }).analyze();
        axe[`${name}/${theme}`] = {
          violations: result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target?.join(' ') })),
          incomplete: result.incomplete.map((v) => `${v.id} (${v.nodes.length})`),
          passes: result.passes.length,
        };
        for (const v of result.violations) {
          fail('axe', `${name}/${theme}: ${v.id} (${v.impact}) on ${v.nodes.length} node(s), first ${v.nodes[0]?.target?.join(' ')}: ${v.nodes[0]?.failureSummary?.split('\n')[1]?.trim() ?? ''}`);
        }

        // Put the page in keyboard modality so :focus-visible applies to script focus.
        await page.keyboard.press('Shift');
        await page.evaluate(() => (document.documentElement.dataset.modality = 'keyboard'));
        const c = await page.evaluate(PAGE_CHECKS, bannedTerms);
        smallest = Math.min(smallest, c.smallestTextPx);
        focusableChecked += c.focusableCount;
        interactiveChecked += c.interactiveCount;
        c.smallTargets.forEach((t) => targets.add(t));
        c.smallText.forEach((t) => fail('text', `${name}/${theme}: ${t}`));
        c.banned.forEach((t) => fail('language', `${name}/${theme}: banned term in primary text: ${t}`));
        c.clipped.forEach((t) => fail('clipped', `${name}/${theme}: ${t}`));
        c.unnamed.forEach((t) => fail('names', `${name}/${theme}: no accessible name: ${t}`));
        c.noFocusStyle.forEach((t) => fail('focus', `${name}/${theme}: no focus-visible change: ${t}`));
        c.notFocusable.forEach((t) => fail('focus', `${name}/${theme}: cannot take focus: ${t}`));
      });
    }
  }

  report.gates.axe = {
    statesChecked: Object.keys(axe).length,
    violations: Object.values(axe).reduce((n, a) => n + a.violations.length, 0),
    incompleteRules: [...new Set(Object.values(axe).flatMap((a) => a.incomplete.map((i) => i.split(' ')[0])))],
    byState: axe,
  };
  report.gates.text = { smallestTextPx: smallest };
  report.gates.focus = { focusableElementsChecked: focusableChecked };
  report.gates.names = { interactiveElementsChecked: interactiveChecked };
  report.gates.language = { bannedTerms: bannedTerms.length };
  report.info = { targetsUnder24px: [...targets] };
}

// ------------------------------------------------------------- overflow ---

async function overflowGate() {
  const out = {};
  const cases = [
    ['1024x700', { width: 1024, height: 700, scale: 1 }],
    ['1024x700 at 125% scale', { width: 1024, height: 700, scale: 1.25 }],
    ['1024x700 at 200% zoom', { width: 512, height: 350, scale: 2 }],
    ['1280x800 at 200% zoom', { width: 640, height: 400, scale: 2 }],
  ];
  for (const [label, options] of cases) {
    for (const name of Object.keys(STATES)) {
      await inState(name, options, async (page) => {
        const c = await page.evaluate(PAGE_CHECKS, []);
        out[`${label}/${name}`] = { scrollWidth: c.scrollWidth, clientWidth: c.clientWidth, outside: c.outside.length };
        if (c.scrollWidth > c.clientWidth) fail('overflow', `${label}/${name}: page scrolls sideways (${c.scrollWidth} > ${c.clientWidth})`);
        c.outside.forEach((o) => fail('overflow', `${label}/${name}: ${o}`));
        if (c.primaryActionReachable === false) fail('overflow', `${label}/${name}: the primary action is outside the window`);
      });
    }
  }
  report.gates.overflow = out;
}

// -------------------------------------------------------------- restore ---

async function restoreGate() {
  const { context, page } = await openPage(browser, { width: 1280, height: 800 });
  await load(page, url);
  await fill(page);
  const read = () =>
    page.evaluate(() => ({ title: document.querySelector('#field-title').value, body: document.querySelector('#field-body').value }));
  const before = await read();
  await page.reload();
  await page.waitForSelector('.app');
  const after = await read();
  const same = JSON.stringify(before) === JSON.stringify(after) && before.body.length > 0;
  if (!same) fail('restore', `work differs after reload: ${JSON.stringify(before)} vs ${JSON.stringify(after)}`);

  // Broken storage must not break the app.
  await page.evaluate((key) => localStorage.setItem(key, '{not json'), DRAFT_KEY);
  await page.reload();
  const usable = await page.waitForSelector('#field-body', { timeout: 3000 }).then(() => true, () => false);
  if (!usable) fail('restore', 'the app did not render with corrupt stored data');
  await context.close();
  report.gates.restore = { restoredAfterReload: same, survivesCorruptStorage: usable };
}

// ------------------------------------------------------------- journeys ---
// Each journey in qa/journeys.json has a script here: an array of steps, each
// one thing a person does (type a run of text, or press one key combination),
// and a check of the result. No pointer is used. The step count may not pass
// the journey's budget.

const type = (text) => ({ label: `type "${text.slice(0, 24)}"`, run: (page) => page.keyboard.type(text) });
const press = (keys) => ({ label: `press ${keys}`, run: (page) => page.keyboard.press(keys) });

const JOURNEY_SCRIPTS = {
  'note-with-item': {
    steps: [type('Plan for the week'), press('Tab'), type('First line of the note.'), press('Control+Shift+R'), type('cedar'), press('Tab'), press('Enter')],
    check: async (page) => {
      await page.waitForTimeout(350);
      const state = await page.evaluate(() => ({
        title: document.querySelector('#field-title').value,
        body: document.querySelector('#field-body').value,
        status: document.querySelector('[data-footer-status]').textContent,
      }));
      const ok = state.title === 'Plan for the week' && state.body.startsWith('First line of the note.') && /Cedar/.test(state.body) && /^Saved at/.test(state.status);
      return ok ? null : `unexpected result ${JSON.stringify(state)}`;
    },
  },
};

async function journeyGate() {
  const out = {};
  for (const journey of journeys) {
    const script = JOURNEY_SCRIPTS[journey.id];
    if (!script) {
      fail('journeys', `${journey.id}: listed in qa/journeys.json but has no script in qa/audit.mjs`);
      continue;
    }
    const { context, page, errors } = await openPage(browser, { width: 1280, height: 800 });
    await load(page, url);
    for (const step of script.steps) await step.run(page);
    const problem = await script.check(page);
    out[journey.id] = { name: journey.name, steps: script.steps.length, stepBudget: journey.stepBudget, passed: !problem };
    if (problem) fail('journeys', `${journey.id}: ${problem}`);
    if (script.steps.length > journey.stepBudget) fail('journeys', `${journey.id}: ${script.steps.length} steps, budget ${journey.stepBudget}`);
    if (errors.length) fail('page', `journey ${journey.id}: ${errors.join(' | ')}`);
    await context.close();
  }
  report.gates.journeys = out;
}

// ------------------------------------------------------------ shortcuts ---
// What each shortcut must visibly do, by the label of its palette row. A row
// with no shortcut must be listed in qa/journeys.json `commandsWithoutShortcut`
// with the reason it is not a repeated action.

const SHORTCUT_EFFECTS = {
  Title: (page) => page.evaluate(() => document.activeElement?.id === 'field-title'),
  Note: (page) => page.evaluate(() => document.activeElement?.id === 'field-body'),
  'All 10,000 items': (page) => page.evaluate(() => document.activeElement?.id === 'rail-filter'),
  'Clear note': (page) => page.waitForSelector('.toast', { timeout: 1500 }).then(() => true, () => false),
  'Use the dark theme': (page) => page.evaluate(() => document.documentElement.dataset.theme === 'dark'),
};

async function shortcutsGate() {
  const exempt = JSON.parse(readFileSync(join(root, 'qa', 'journeys.json'), 'utf8')).commandsWithoutShortcut.map((c) => c.label);
  const { context, page } = await openPage(browser, { width: 1280, height: 800 });
  await load(page, url);
  await fill(page);
  await openPalette(page);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.palette [role="option"]')].map((row) => ({
      label: row.querySelector('span')?.textContent.trim() ?? '',
      keys: [...row.querySelectorAll('[data-keys] kbd')].map((k) => k.textContent.trim()),
    })),
  );
  await page.keyboard.press('Escape');
  const out = { commands: rows.length, withShortcut: 0, worked: [] };
  for (const row of rows) {
    if (!row.keys.length) {
      if (!exempt.includes(row.label)) fail('shortcuts', `"${row.label}" has no shortcut and is not listed in commandsWithoutShortcut`);
      continue;
    }
    out.withShortcut += 1;
    const effect = SHORTCUT_EFFECTS[row.label];
    if (!effect) {
      fail('shortcuts', `"${row.label}" has no effect check in qa/audit.mjs`);
      continue;
    }
    await page.locator('#field-body').focus();
    await page.keyboard.press(row.keys.map((k) => (k === 'Ctrl' ? 'Control' : k === '↵' ? 'Enter' : k)).join('+'));
    await page.waitForTimeout(120);
    if (await effect(page)) out.worked.push(row.label);
    else fail('shortcuts', `${row.keys.join('+')} did not do "${row.label}"`);
  }
  // Tooltips show the shortcut of the control they describe.
  await page.hover('[aria-label="Use the dark theme"], [aria-label="Use the light theme"]');
  const tip = await page.waitForSelector('.tooltip', { timeout: 2000 }).then((el) => el.textContent(), () => '');
  out.tooltipShowsKeys = /Ctrl/.test(tip ?? '');
  if (!out.tooltipShowsKeys) fail('shortcuts', 'the theme button tooltip does not show its shortcut');
  await context.close();
  report.gates.shortcuts = out;
}

// ------------------------------------------------------------------ run ---

try {
  await cssGate();
  await motionGate();
  await listGate();
  await stateGates();
  await overflowGate();
  await restoreGate();
  await journeyGate();
  await shortcutsGate();
} catch (error) {
  fail('audit', `the audit itself failed: ${String(error?.stack ?? error).split('\n').slice(0, 3).join(' ')}`);
} finally {
  await browser.close();
  await close();
}

report.failures = failures;
report.passed = failures.length === 0;
await writeFile(join(root, 'qa', 'audit.json'), JSON.stringify(report, null, 2));

const g = report.gates;
console.log(`css        ${g.css?.declarationsRead ?? 0} declarations, longest ${g.css?.longestMs ?? '?'} ms, self-test ${g.css?.selfTest ?? 'not run'}`);
console.log(`list       ${g.list ? `${g.list.top.domRows} to ${g.list.end.domRows} DOM rows of ${g.list.top.totalRows}` : 'not run'}`);
console.log(`axe        ${g.axe ? `${g.axe.violations} violations in ${g.axe.statesChecked} state and theme runs` : 'not run'}`);
console.log(`focus      ${g.focus?.focusableElementsChecked ?? 0} focus checks; names ${g.names?.interactiveElementsChecked ?? 0}; smallest text ${g.text?.smallestTextPx ?? '?'} px`);
console.log(`overflow   ${g.overflow ? Object.keys(g.overflow).length : 0} layout cases`);
console.log(`restore    ${g.restore ? `reload ${g.restore.restoredAfterReload}, corrupt storage ${g.restore.survivesCorruptStorage}` : 'not run'}`);
console.log(`journeys   ${g.journeys ? Object.entries(g.journeys).map(([id, j]) => `${id} ${j.steps}/${j.stepBudget} steps`).join(', ') : 'not run'}`);
console.log(`shortcuts  ${g.shortcuts ? `${g.shortcuts.withShortcut} of ${g.shortcuts.commands} commands, ${g.shortcuts.worked.length} worked` : 'not run'}`);
if (failures.length) {
  console.error(`\naudit FAILED: ${failures.length} failure(s)`);
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('\naudit passed');
