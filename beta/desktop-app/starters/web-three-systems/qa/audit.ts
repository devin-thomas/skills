// Audits the production build headlessly and writes qa/audit.json.
// Exits 1 with the failures printed when any gate fails.
//
// Gates (the premium-bar rule each one checks is in brackets). Every state is
// opened on a fixture of the stand-in bridge (src/bridge.fake.ts), so no shell,
// no tool and no window is involved; the browser is headless and muted.
//   css        no `transition: all`, no animated layout property, nothing over 300 ms
//              except a sheet (450 ms), read from the shipped stylesheets [13, 14, 15]
//   motion     the same limits on animations that actually ran; popovers grow from their
//              trigger; no motion for keyboard actions; no transform motion under
//              prefers-reduced-motion [13, 15, 18, 20, 22]
//   list       DOM rows in the 10,000-row list stay near the visible count [26]
//   axe        zero violations in both themes, every state [37]
//   focus      every keyboard-focusable element changes appearance on focus [5]
//   names      every interactive element has an accessible name that contains its visible
//              label [36]
//   text       no text under 12 px [31]
//   language   no banned term (qa/banned-terms.json), matched as a whole word, in any text
//              a person can read, Details and About included [49]
//   buttons    no filled button reads Details, Show details or OK [73]
//   desktop    nothing that reads as a web form: no native range, select, number, checkbox
//              or radio input, no title tooltip, no pointer cursor, no capitals or
//              letter-spaced label, no blur, glow or gradient, no slogan heading [80]
//   clipped    a scroll area that hides content shows a fading edge or a scrollbar [38]
//   overflow   nothing outside the window at the app's default and minimum window size
//              (app.config.json), 125% scale and 200% zoom [38]
//   spill      nothing a person operates spills out of its region or the window, regions do
//              not overlap, and the window has no scroll range; a root with hidden overflow
//              does not pass this by hiding the spill [81]
//   stable     at each of those sizes, the title bar, the work area and the status bar sit in
//              the same place in every state, and the status bar has one height [74]
//   restore    unsaved work survives a reload and corrupt storage [44, page level only]
//   journeys   each journey in qa/journeys.json runs by keyboard alone within its step
//              budget, once with Ctrl (Windows and Linux) and once with Command (macOS) [6, 47]
//   shortcuts  every command is in the palette with its shortcut written as the system writes
//              it, tooltips show shortcuts, and each shortcut works on both key families [46]
//   overlay    keys typed straight after the key that opens an overlay land in it [6]
//   job        cancel is acknowledged at once; each failure's filled button can succeed for
//              its cause; "Copy details" copies the developer text without showing it, into
//              a clipboard the audit captures (never the machine's) [50, 58, 65, 73]
//
// The states, the journey scripts, the shortcut effects and the job fixtures below
// describe the starter screen. Rewrite those blocks for the app; the gates stay.
import { AxeBuilder } from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright-core';
import { fill, launch, load, openPage, park, readConfig, root, serve, settle } from './lib.ts';
import type { MotionRecord, PageOptions } from './lib.ts';

/** One entry of qa/journeys.json. */
interface Journey {
  id: string;
  name: string;
  stepBudget: number;
}
/** qa/journeys.json: the essential journeys, and the commands that have no shortcut and why. */
interface JourneysFile {
  journeys: Journey[];
  commandsWithoutShortcut: { label: string; reason: string }[];
}
/** qa/banned-terms.json: words matched as whole words (any case), and words matched exactly. */
interface BannedTerms {
  terms: string[];
  exact: string[];
}

const config = readConfig();
const journeys = (JSON.parse(readFileSync(join(root, 'qa', 'journeys.json'), 'utf8')) as JourneysFile).journeys;
const termsFile = JSON.parse(readFileSync(join(root, 'qa', 'banned-terms.json'), 'utf8')) as Partial<BannedTerms>;
const bannedTerms: BannedTerms = { terms: termsFile.terms ?? [], exact: termsFile.exact ?? [] };
// The app's own default and minimum window, 125% scale of the default, and 200% zoom of the
// default (build 2: sizes chosen by the audit instead of the app missed the app's real minimum).
const W = config.window;
const SIZES: [label: string, options: PageOptions][] = [
  [`${W.width}x${W.height} default`, { width: W.width, height: W.height, scale: 1 }],
  [`${W.minWidth}x${W.minHeight} minimum`, { width: W.minWidth, height: W.minHeight, scale: 1 }],
  [`${W.width}x${W.height} at 125% scale`, { width: W.width, height: W.height, scale: 1.25 }],
  [`${W.width}x${W.height} at 200% zoom`, { width: Math.round(W.width / 2), height: Math.round(W.height / 2), scale: 2 }],
];
const VIEW: PageOptions = { width: W.width, height: W.height, scale: 1 };
const DRAFT_KEY = `${config.storagePrefix}.draft.v1`;

type Run = (page: Page) => Promise<unknown>;
interface CssDeclaration {
  selector: string;
  name: string;
  raw: string;
  value: string;
  loops?: boolean;
}
interface MotionGate {
  pointer: Record<string, string[]>;
  keyboard: Record<string, string[]>;
  reducedMotion: { ran?: string[] };
  tooltipTransformOrigin?: { x: number; y: number; width: number; height: number };
}
interface ListSample {
  domRows: number;
  visibleRows: number;
  totalRows: number;
  scrollHeight: number;
}
interface AxeState {
  violations: { id: string; impact: string | null | undefined; nodes: number; first: string | undefined }[];
  incomplete: string[];
  passes: number;
}
type Geometry = Record<string, number[] | null>;
interface ShortcutResult {
  commands: number;
  withShortcut: number;
  worked: string[];
  tooltipShowsKeys?: boolean;
}
type JobGate = { cancelAcknowledged?: string | null | undefined; secondFailure?: { text: string; filled: string[] } } & Record<string, unknown>;
/** What the audit writes to qa/audit.json: one entry per gate that ran, in the shape the gate reports. */
interface Gates {
  css?: { selfTest: string; declarationsRead: number; longestMs: number; longestSheetMs: number; violations: string[] };
  motion?: MotionGate;
  list?: { top: ListSample; middle: ListSample; end: ListSample };
  axe?: { statesChecked: number; violations: number; incompleteRules: string[]; byState: Record<string, AxeState> };
  text?: { smallestTextPx: number };
  focus?: { focusableElementsChecked: number };
  names?: { interactiveElementsChecked: number };
  language?: { bannedTerms: number };
  desktop?: { statesChecked: number };
  overflow?: Record<string, { scrollWidth: number; clientWidth: number; outside: number; spill: number }>;
  stable?: { sizes: string[]; anchors: string[]; statesPerSize: number };
  restore?: { restoredAfterReload: boolean; survivesCorruptStorage: boolean };
  journeys?: Record<string, { name: string; steps: number; stepBudget: number; passed: boolean }>;
  shortcuts?: Record<string, ShortcutResult>;
  overlay?: Record<string, { query: string | null; body: string }>;
  job?: JobGate;
}
interface Report {
  generatedFor: string;
  browser?: { channel: string; version: string };
  gates: Gates;
  info?: { targetsUnder24px: string[] };
  failures?: string[];
  passed?: boolean;
}

const failures: string[] = [];
const report: Report = { generatedFor: 'dist/page/', gates: {} };
const fail = (gate: string, message: string) => failures.push(`[${gate}] ${message}`);

const { url, close } = await serve();
const { browser, channel } = await launch();
report.browser = { channel, version: browser.version() };

// ---------------------------------------------------------------- states ---

const openPalette = async (page: Page): Promise<void> => {
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.palette');
};

// The shortcut shows the list first, which matters when the window is too narrow to dock it.
const filterItems = async (page: Page, text: string): Promise<void> => {
  await page.keyboard.press('Control+Shift+R');
  await page.waitForFunction(() => document.activeElement?.id === 'rail-filter');
  await page.keyboard.type(text);
};

// Name: the stand-in fixture it opens on and the steps that reach it. Every one is
// checked with axe in both themes and laid out at all four sizes.
const STATES: Record<string, { fixture: string; run: Run }> = {
  empty: { fixture: 'default', run: async () => {} },
  filled: { fixture: 'default', run: async (page) => fill(page) },
  filtered: {
    fixture: 'default',
    run: async (page) => {
      await fill(page);
      await filterItems(page, 'cedar');
    },
  },
  'no-match': { fixture: 'default', run: async (page) => filterItems(page, 'zzq') },
  palette: {
    fixture: 'default',
    run: async (page) => {
      await fill(page);
      await openPalette(page);
    },
  },
  'palette-no-match': {
    fixture: 'default',
    run: async (page) => {
      await openPalette(page);
      await page.keyboard.type('zzq');
    },
  },
  about: {
    fixture: 'default',
    run: async (page) => {
      await openPalette(page);
      await page.keyboard.type('about');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.dialog');
    },
  },
  toast: {
    fixture: 'default',
    run: async (page) => {
      await fill(page);
      await page.click('#action-clear');
      await page.waitForSelector('.toast');
    },
  },
  'job-running': { fixture: 'job-running', run: async (page) => runJob(page, 'running') },
  'job-unknown-total': { fixture: 'job-unknown-total', run: async (page) => runJob(page, 'running') },
  'job-done': { fixture: 'job-done', run: async (page) => runJob(page, 'done') },
  'job-stopped': { fixture: 'job-cancelled', run: async (page) => runJob(page, 'stopped') },
  'job-failed-retry': { fixture: 'job-failed-OUTPUT_IN_USE', run: async (page) => runJob(page, 'failed') },
  'job-failed-unknown': { fixture: 'job-failed-SOMETHING_NEW', run: async (page) => runJob(page, 'failed') },
  'tool-damaged': { fixture: 'damaged', run: async () => {} },
};

async function runJob(page: Page, until: string): Promise<void> {
  await page.keyboard.press('Control+Shift+E');
  await page.waitForSelector(`[data-status-bar][data-job="${until}"]`, { timeout: 5000 });
}

async function inState<T>(name: string, options: PageOptions, run: (page: Page) => Promise<T>): Promise<T> {
  const { context, page, errors } = await openPage(browser, options);
  try {
    const state = STATES[name];
    if (!state) throw new Error(`no state named ${name}`);
    await load(page, url, state.fixture);
    await state.run(page);
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
    const resolve = (text: string): string => {
      let out = text;
      for (let i = 0; i < 6 && out.includes('var('); i++) {
        out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,[^()]*)?\)/g, (_: string, name: string) => rootStyle.getPropertyValue(name).trim() || '0s');
      }
      return out;
    };
    const found: CssDeclaration[] = [];
    const walk = (list: CSSRuleList, prefix: string): void => {
      for (const rule of [...list] as (CSSStyleRule & CSSGroupingRule)[]) {
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

  const splitTop = (text: string): string[] => {
    const parts: string[] = [];
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
  const toMs = (token: string) => (token.endsWith('ms') ? parseFloat(token) : parseFloat(token) * 1000);
  const times = (segment: string) => (segment.replace(/\([^()]*\)/g, '').match(/(?<![\w.-])\d*\.?\d+m?s\b/g) ?? []).map(toMs);

  let longest = 0;
  let longestSheet = 0;
  let violations: string[] = [];
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
        const property = segment.split(/\s+/)[0] ?? '';
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

const RECORDER = (): void => {
  window.__seen = new WeakSet();
  window.__motion = [];
  const describe = (el: Element | null): string => {
    if (!el) return 'unknown';
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
  };
  const tick = () => {
    for (const animation of document.getAnimations()) {
      if (window.__seen.has(animation)) continue;
      window.__seen.add(animation);
      const effect = animation.effect as KeyframeEffect | null;
      const timing: ComputedEffectTiming = effect?.getComputedTiming?.() ?? {};
      const target = effect?.target ?? null;
      let properties: string[] = [];
      try {
        properties = [...new Set((effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k)))].filter(
          (k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k),
        );
      } catch {
        properties = [];
      }
      window.__motion.push({
        kind: animation.constructor.name,
        name: (animation as Animation & { transitionProperty?: string; animationName?: string }).transitionProperty ?? (animation as Animation & { animationName?: string }).animationName ?? 'script',
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

const drain = (page: Page): Promise<MotionRecord[]> =>
  page.evaluate(() => {
    const out = window.__motion;
    window.__motion = [];
    return out;
  });

const LAYOUT_JS = ['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding', 'fontSize', 'inset'];
// Endless animations that are allowed: the spinner, and the scroll-driven fade at the end of a scroll area.
const ENDLESS_OK = ['spin', 'scroll-cue'];

function judge(records: MotionRecord[], label: string): string[] {
  const violations: string[] = [];
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
  const out: MotionGate = { pointer: {}, keyboard: {}, reducedMotion: {} };
  const themeButton = '[aria-label="Use the dark theme"], [aria-label="Use the light theme"]';

  // Pointer session: everything a mouse user triggers.
  {
    const { context, page } = await openPage(browser, { width: 1280, height: 800 });
    await page.addInitScript(RECORDER);
    await load(page, url);
    await fill(page);
    await drain(page);
    const steps: [string, () => Promise<void>][] = [
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
      const popup = document.querySelector('.tooltip') as Element;
      const box = popup.getBoundingClientRect();
      const [x = NaN, y = NaN] = getComputedStyle(popup).transformOrigin.split(' ').map(parseFloat);
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
    const steps: [string, () => Promise<void>][] = [
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
  const top = await measure();
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight / 2));
  await page.waitForTimeout(150);
  const middle = await measure();
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.waitForTimeout(150);
  const end = await measure();
  const samples = { top, middle, end };
  await context.close();
  report.gates.list = samples;
  for (const [where, s] of Object.entries(samples)) {
    if (s.totalRows !== 10000) fail('list', `${where}: list reports ${s.totalRows} rows, expected 10000`);
    if (s.domRows > s.visibleRows + 16) fail('list', `${where}: ${s.domRows} DOM rows for ${s.visibleRows} visible`);
    if (s.domRows < s.visibleRows) fail('list', `${where}: only ${s.domRows} DOM rows for ${s.visibleRows} visible`);
  }
}

// -------------------------------------------------- per-state page checks ---

/** An element a person operates, with the two properties only some controls have. */
type Control = HTMLElement & { disabled?: boolean; labels?: NodeListOf<HTMLLabelElement> | null };

const PAGE_CHECKS = async (terms: BannedTerms) => {
  const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  const visible = (el: Element): boolean => {
    if (el.closest('[inert]')) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  const describe = (el: Element): string => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const label = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? '';
    return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ''} "${label}"`;
  };

  // -- text size
  const small: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let smallest = Infinity;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node.textContent ?? '').trim()) continue;
    const el = node.parentElement;
    if (!el || !visible(el) || el.closest('script,style')) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    smallest = Math.min(smallest, size);
    if (size < 12) small.push(`${describe(el)} at ${size}px`);
  }

  // -- plain language: no banned term in any text a person can read, Details and About
  //    included. Developer text is never on screen; "Copy details" copies it without showing it.
  //    Whole words only: "rate" must not match "generate", nor "lab" "available" (build 2 found
  //    the substring match gave false hits).
  const banned: string[] = [];
  if (terms.terms.length || terms.exact.length) {
    const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const whole = (list: string[], flags: string) => (list.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${list.map(escape).join('|')})(?![\\p{L}\\p{N}])`, flags) : null);
    const loose = whole(terms.terms, 'iu');
    const exact = whole(terms.exact, 'u');
    const BANNED = { test: (text: string) => Boolean(loose?.test(text) || exact?.test(text)) };
    const words = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = words.nextNode(); node; node = words.nextNode()) {
      const el = node.parentElement;
      if (!el || !visible(el) || el.closest('script,style')) continue;
      if (BANNED.test(node.textContent ?? '')) banned.push(`"${(node.textContent ?? '').trim().slice(0, 70)}"`);
    }
    for (const el of document.querySelectorAll('[placeholder],[aria-label]')) {
      if (!visible(el)) continue;
      const text = `${el.getAttribute('placeholder') ?? ''} ${el.getAttribute('aria-label') ?? ''}`;
      if (BANNED.test(text)) banned.push(`attribute "${text.trim()}"`);
    }
  }

  // -- no filled button that only reveals or dismisses (critique of builds 1 and 2)
  const filledWrong: string[] = [];
  for (const el of document.querySelectorAll('.btn-primary, [data-filled]')) {
    if (!visible(el)) continue;
    const text = (el.textContent ?? '').trim();
    if (/^(show |hide )?details$|^ok$/i.test(text)) filledWrong.push(`${describe(el)} is a filled button reading "${text}"`);
  }

  // -- what makes a web page of a desktop app (a finding of build 2's research)
  const webForm: string[] = [];
  for (const el of document.querySelectorAll('select, input[type="range"], input[type="number"], input[type="checkbox"], input[type="radio"], [title]')) {
    if (visible(el) && !el.closest('svg')) webForm.push(`${describe(el)} is a native form control or carries a title tooltip`);
  }
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const st = getComputedStyle(el);
    if (st.cursor === 'pointer') webForm.push(`${describe(el)} has a pointer cursor`);
    if (st.backdropFilter && st.backdropFilter !== 'none') webForm.push(`${describe(el)} blurs what is behind it`);
    if (/gradient/.test(st.backgroundImage)) webForm.push(`${describe(el)} has a gradient background`);
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 1);
    if (!own) continue;
    if (st.textTransform === 'uppercase') webForm.push(`${describe(el)} is set in capitals`);
    if (parseFloat(st.letterSpacing) > parseFloat(st.fontSize) * 0.04) webForm.push(`${describe(el)} is letter-spaced like a label above a heading`);
    if (/^h[1-6]$/i.test(el.tagName) && /[.!?]\s+\S|, not /.test((el.textContent ?? '').trim())) webForm.push(`heading "${(el.textContent ?? '').trim().slice(0, 50)}" reads as a slogan`);
  }

  // -- a scroll area that hides content must show it: a fading edge or a scrollbar
  const clipped: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('*')) {
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
    ...document.querySelectorAll<Control>(
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

  const nameOf = (el: Control): string => {
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
      if (text) return text;
    }
    const aria = el.getAttribute('aria-label');
    if (aria?.trim()) return aria.trim();
    if (el.labels?.length) return [...el.labels].map((l) => l.textContent ?? '').join(' ').trim();
    if (el.matches('input, textarea, select')) return (el.getAttribute('title') ?? el.getAttribute('placeholder') ?? '').trim();
    return (el.textContent ?? '').trim() || (el.getAttribute('title') ?? '').trim();
  };
  const unnamed = interactive
    .filter((el) => !el.matches('[tabindex="-1"]:not(button):not([role])'))
    .filter((el) => !nameOf(el))
    .map(describe);
  // The accessible name contains the visible label (WCAG 2.5.3), so a person who says what
  // they see reaches the control by voice.
  const squash = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  const labelNotInName = interactive
    .filter((el) => el.matches('button, a[href], [role="option"], [role="tab"]') && el.hasAttribute('aria-label'))
    .filter((el) => {
      const shown = squash([...el.childNodes].filter((n) => n.nodeType === 3 || (n.nodeType === 1 && (n as Element).getAttribute('aria-hidden') !== 'true')).map((n) => n.textContent ?? '').join(' '));
      return shown && !squash(nameOf(el)).includes(shown);
    })
    .map(describe);

  const signature = (el: HTMLElement): string => {
    const parts: string[] = [];
    let node: HTMLElement | null = el;
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
  const previous = document.activeElement as HTMLElement | null;
  const noFocusStyle: string[] = [];
  const notFocusable: string[] = [];
  for (const el of focusable) {
    (document.activeElement as HTMLElement | null)?.blur?.();
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
  const outside: string[] = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const box = el.getBoundingClientRect();
    if (box.right > vw + 1 || box.left < -1) outside.push(`${describe(el)} spans ${Math.round(box.left)}..${Math.round(box.right)} of ${vw}`);
  }
  const action = document.querySelector('[data-primary-action], #action-clear');
  const actionBox = action?.getBoundingClientRect();

  // -- spill: nothing a person operates spills out of its region or the window, and regions
  //    do not overlap. A root with `overflow: hidden` makes "the window never scrolls" pass
  //    trivially (build 2), so this checks what is cut off rather than whether it scrolls.
  const vh = window.innerHeight;
  const spill: string[] = [];
  const REGIONS: [string, string][] = [
    ['.titlebar', '.titlebar button, .titlebar h1'],
    ['.card', '.card button, .card input, .card textarea, .card label'],
    ['[data-status-bar]', '[data-status-bar] button, [data-status-bar] p, [data-status-bar] [role="progressbar"]'],
  ];
  for (const [regionSelector, inside] of REGIONS) {
    const region = document.querySelector(regionSelector);
    if (!region || !visible(region)) continue;
    const r = region.getBoundingClientRect();
    if (r.top < -1 || r.left < -1 || r.bottom > vh + 1 || r.right > vw + 1) spill.push(`${regionSelector} spans ${Math.round(r.top)}..${Math.round(r.bottom)} of ${vh} high, ${Math.round(r.left)}..${Math.round(r.right)} of ${vw} wide`);
    for (const el of document.querySelectorAll(inside)) {
      if (!visible(el)) continue;
      let scroller = el.parentElement;
      while (scroller && scroller !== region && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      if (scroller && scroller !== region && region.contains(scroller)) continue; // reached by scrolling
      const box = el.getBoundingClientRect();
      if (box.top < r.top - 1 || box.bottom > r.bottom + 1 || box.left < r.left - 1 || box.right > r.right + 1) spill.push(`${describe(el)} spills out of ${regionSelector} (${Math.round(box.top)}..${Math.round(box.bottom)} in ${Math.round(r.top)}..${Math.round(r.bottom)})`);
    }
  }
  const regions = ['.titlebar', '.workspace', '[data-status-bar]'].map((sel) => document.querySelector(sel)).filter((el): el is Element => el !== null && visible(el));
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const ra = regions[i];
      const rb = regions[j];
      if (!ra || !rb) continue;
      const a = ra.getBoundingClientRect();
      const b = rb.getBoundingClientRect();
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) spill.push(`${describe(ra)} overlaps ${describe(rb)}`);
    }
  }
  const scroller = document.scrollingElement ?? document.documentElement;
  return {
    smallestTextPx: smallest,
    smallText: small,
    banned,
    filledWrong,
    webForm: [...new Set(webForm)].slice(0, 12),
    clipped,
    interactiveCount: interactive.length,
    focusableCount: focusable.length,
    unnamed,
    labelNotInName,
    noFocusStyle,
    notFocusable,
    smallTargets,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: vw,
    outside: outside.slice(0, 12),
    spill,
    scrollRange: { x: scroller.scrollWidth - scroller.clientWidth, y: scroller.scrollHeight - scroller.clientHeight },
    primaryActionReachable: actionBox ? actionBox.bottom <= window.innerHeight + 1 && actionBox.right <= vw + 1 : null,
  };
};

async function stateGates() {
  const axe: Record<string, AxeState> = {};
  let smallest = Infinity;
  let focusableChecked = 0;
  let interactiveChecked = 0;
  const targets = new Set<string>();

  for (const theme of ['light', 'dark'] as const) {
    for (const name of Object.keys(STATES)) {
      await inState(name, { ...VIEW, theme }, async (page) => {
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
        c.labelNotInName.forEach((t) => fail('names', `${name}/${theme}: the accessible name does not contain the visible label: ${t}`));
        c.filledWrong.forEach((t) => fail('buttons', `${name}/${theme}: ${t}`));
        c.webForm.forEach((t) => fail('desktop', `${name}/${theme}: ${t}`));
        c.noFocusStyle.forEach((t) => fail('focus', `${name}/${theme}: no focus-visible change: ${t}`));
        c.notFocusable.forEach((t) => fail('focus', `${name}/${theme}: cannot take focus: ${t}`));
      });
    }
  }

  report.gates.axe = {
    statesChecked: Object.keys(axe).length,
    violations: Object.values(axe).reduce((n, a) => n + a.violations.length, 0),
    incompleteRules: [...new Set(Object.values(axe).flatMap((a) => a.incomplete.map((i) => i.split(' ')[0] ?? i)))],
    byState: axe,
  };
  report.gates.text = { smallestTextPx: smallest };
  report.gates.focus = { focusableElementsChecked: focusableChecked };
  report.gates.names = { interactiveElementsChecked: interactiveChecked };
  report.gates.language = { bannedTerms: bannedTerms.terms.length + bannedTerms.exact.length };
  report.gates.desktop = { statesChecked: Object.keys(axe).length };
  report.info = { targetsUnder24px: [...targets] };
}

// ------------------------------------------------------------- overflow ---

// What a person must always find in the same place, in every state: the title bar, the work
// area and the status bar, and the status bar's height (critique of build 2, must-fix 4).
const ANCHORS = ['.titlebar', '.workspace', '.card', '[data-status-bar]'];
const geometry = (page: Page): Promise<Geometry> =>
  page.evaluate((anchors) => {
    const out: Record<string, number[] | null> = {};
    for (const selector of anchors) {
      const el = document.querySelector(selector);
      const box = el?.getBoundingClientRect();
      out[selector] = box ? [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)] : null;
    }
    return out;
  }, ANCHORS);

async function overflowGate() {
  const out: NonNullable<Gates['overflow']> = {};
  const stable: Record<string, Geometry> = {};
  const none: BannedTerms = { terms: [], exact: [] };
  for (const [label, options] of SIZES) {
    let reference: { name: string; g: Geometry } | null = null;
    for (const name of Object.keys(STATES)) {
      await inState(name, options, async (page) => {
        const c = await page.evaluate(PAGE_CHECKS, none);
        out[`${label}/${name}`] = { scrollWidth: c.scrollWidth, clientWidth: c.clientWidth, outside: c.outside.length, spill: c.spill.length };
        if (c.scrollWidth > c.clientWidth) fail('overflow', `${label}/${name}: page scrolls sideways (${c.scrollWidth} > ${c.clientWidth})`);
        c.outside.forEach((o) => fail('overflow', `${label}/${name}: ${o}`));
        if (c.primaryActionReachable === false) fail('overflow', `${label}/${name}: the primary action is outside the window`);
        c.spill.forEach((o) => fail('spill', `${label}/${name}: ${o}`));
        if (c.scrollRange.x > 0 || c.scrollRange.y > 0) fail('spill', `${label}/${name}: the window itself scrolls (${JSON.stringify(c.scrollRange)})`);
        const g = await geometry(page);
        stable[`${label}/${name}`] = g;
        const ref = reference ?? (reference = { name, g });
        for (const selector of ANCHORS) {
          if (JSON.stringify(g[selector]) !== JSON.stringify(ref.g[selector])) {
            fail('stable', `${label}/${name}: ${selector} is at ${JSON.stringify(g[selector])}, in ${ref.name} at ${JSON.stringify(ref.g[selector])}`);
          }
        }
      });
    }
  }
  report.gates.overflow = out;
  report.gates.stable = { sizes: SIZES.map(([l]) => l), anchors: ANCHORS, statesPerSize: Object.keys(STATES).length };
}

// -------------------------------------------------------------- restore ---

async function restoreGate() {
  const { context, page } = await openPage(browser, { width: 1280, height: 800 });
  await load(page, url);
  await fill(page);
  const read = () =>
    page.evaluate(() => ({ title: (document.querySelector('#field-title') as HTMLInputElement).value, body: (document.querySelector('#field-body') as HTMLTextAreaElement).value }));
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
// the journey's budget. Every journey runs twice: with Ctrl (the stand-in says
// Windows) and with Command (the stand-in says macOS). "Mod" in a key names the
// family's modifier.

const KEY_FAMILIES: ['windows' | 'macos', 'Control' | 'Meta'][] = [
  ['windows', 'Control'],
  ['macos', 'Meta'],
];
/** One thing a person does in a journey. */
interface Step {
  label: string;
  run: (page: Page, mod: string) => Promise<void>;
}
const type = (text: string): Step => ({ label: `type "${text.slice(0, 24)}"`, run: (page) => page.keyboard.type(text) });
const press = (keys: string): Step => ({ label: `press ${keys}`, run: (page, mod) => page.keyboard.press(keys.replace('Mod', mod)) });

const JOURNEY_SCRIPTS: Record<string, { fixture: string; steps: Step[]; check: (page: Page) => Promise<string | null> }> = {
  'note-with-item': {
    fixture: 'default',
    steps: [type('Plan for the week'), press('Tab'), type('First line of the note.'), press('Mod+Shift+R'), type('cedar'), press('Tab'), press('Enter')],
    check: async (page) => {
      await page.waitForTimeout(350);
      const state = await page.evaluate(() => ({
        title: (document.querySelector('#field-title') as HTMLInputElement).value,
        body: (document.querySelector('#field-body') as HTMLTextAreaElement).value,
        status: (document.querySelector('[data-footer-status]') as Element).textContent ?? '',
      }));
      const ok = state.title === 'Plan for the week' && state.body.startsWith('First line of the note.') && /Cedar/.test(state.body) && /^Saved at/.test(state.status);
      return ok ? null : `unexpected result ${JSON.stringify(state)}`;
    },
  },
  'run-example': {
    fixture: 'default',
    steps: [press('Mod+Shift+E')],
    check: async (page) => {
      const done = await page.waitForSelector('[data-status-bar][data-job="done"]', { timeout: 5000 }).then(() => true, () => false);
      return done ? null : 'the example did not finish';
    },
  },
};

async function journeyGate() {
  const out: NonNullable<Gates['journeys']> = {};
  for (const journey of journeys) {
    const script = JOURNEY_SCRIPTS[journey.id];
    if (!script) {
      fail('journeys', `${journey.id}: listed in qa/journeys.json but has no script in qa/audit.ts`);
      continue;
    }
    for (const [platform, mod] of KEY_FAMILIES) {
      const { context, page, errors } = await openPage(browser, VIEW);
      await load(page, url, script.fixture, `platform=${platform}`);
      for (const step of script.steps) await step.run(page, mod);
      const problem = await script.check(page);
      out[`${journey.id}/${platform}`] = { name: journey.name, steps: script.steps.length, stepBudget: journey.stepBudget, passed: !problem };
      if (problem) fail('journeys', `${journey.id} (${platform} keys): ${problem}`);
      if (script.steps.length > journey.stepBudget) fail('journeys', `${journey.id}: ${script.steps.length} steps, budget ${journey.stepBudget}`);
      if (errors.length) fail('page', `journey ${journey.id} (${platform}): ${errors.join(' | ')}`);
      await context.close();
    }
  }
  report.gates.journeys = out;
}

// ------------------------------------------------------------ shortcuts ---
// What each shortcut must visibly do, by the label of its palette row. A row
// with no shortcut must be listed in qa/journeys.json `commandsWithoutShortcut`
// with the reason it is not a repeated action. Each label is one string written
// as the system writes it ("Ctrl+Shift+D"; "⇧⌘D"), and each key works on both
// families.

const SHORTCUT_EFFECTS: Record<string, (page: Page) => Promise<boolean>> = {
  Title: (page) => page.evaluate(() => document.activeElement?.id === 'field-title'),
  Note: (page) => page.evaluate(() => document.activeElement?.id === 'field-body'),
  'All 10,000 items': (page) => page.evaluate(() => document.activeElement?.id === 'rail-filter'),
  'Clear note': (page) => page.waitForSelector('.toast', { timeout: 1500 }).then(() => true, () => false),
  'Run the example': (page) => page.waitForSelector('[data-status-bar][data-job="running"], [data-status-bar][data-job="done"]', { timeout: 1500 }).then(() => true, () => false),
  'Use the dark theme': (page) => page.evaluate(() => document.documentElement.dataset.theme === 'dark'),
  'Use the light theme': (page) => page.evaluate(() => document.documentElement.dataset.theme === 'light'),
};
// A command that only applies in another state is set up first.
const SHORTCUT_SETUP: Record<string, { fixture: string; setup: (page: Page, mod: string) => Promise<void>; effect: (page: Page) => Promise<boolean> }> = {
  'Cancel the example': {
    fixture: 'job-running',
    setup: async (page, mod) => {
      await page.keyboard.press(`${mod}+Shift+E`);
      await page.waitForSelector('[data-status-bar][data-job="running"]');
    },
    effect: (page) => page.waitForSelector('[data-status-bar][data-job="stopped"]', { timeout: 1500 }).then(() => true, () => false),
  },
};
const LABEL_FORMAT: Record<string, RegExp> = { windows: /^(Ctrl\+)?(Alt\+)?(Shift\+)?[^+\s]+$/, macos: /^⌥?⇧?⌘?[^+\s⌘⇧⌥]+$/ };
const toPlaywright = (label: string, platform: string): string => {
  if (platform === 'macos') {
    const mods = [...label].filter((ch) => '⌥⇧⌘'.includes(ch)).map((ch) => (({ '⌥': 'Alt', '⇧': 'Shift', '⌘': 'Meta' }) as Record<string, string>)[ch]);
    const key = [...label].filter((ch) => !'⌥⇧⌘'.includes(ch)).join('');
    return [...mods, key === '↩' ? 'Enter' : key].join('+');
  }
  return label.replace('Ctrl', 'Control');
};

async function shortcutsGate() {
  const exempt = (JSON.parse(readFileSync(join(root, 'qa', 'journeys.json'), 'utf8')) as JourneysFile).commandsWithoutShortcut.map((c) => c.label.replace('{productName}', config.productName));
  const out: Record<string, ShortcutResult> = {};
  for (const [platform, mod] of KEY_FAMILIES) {
    const { context, page } = await openPage(browser, VIEW);
    await load(page, url, 'default', `platform=${platform}`);
    await fill(page);
    await page.keyboard.press(`${mod}+k`);
    await page.waitForSelector('.palette');
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('.palette [role="option"]')].map((row) => ({
        label: row.querySelector('span')?.textContent?.trim() ?? '',
        keys: [...row.querySelectorAll('[data-keys] kbd')].map((k) => (k.textContent ?? '').trim()),
      })),
    );
    await page.keyboard.press('Escape');
    await context.close();
    const result: ShortcutResult = { commands: rows.length, withShortcut: 0, worked: [] };
    for (const row of rows) {
      if (!row.keys.length) {
        if (!exempt.includes(row.label)) fail('shortcuts', `"${row.label}" has no shortcut and is not listed in commandsWithoutShortcut`);
        continue;
      }
      result.withShortcut += 1;
      const keys = row.keys[0] ?? '';
      if (row.keys.length !== 1 || !LABEL_FORMAT[platform]?.test(keys)) fail('shortcuts', `${platform}: "${row.label}" shows ${JSON.stringify(row.keys)}, not one key cap written as the system writes it`);
      const special = SHORTCUT_SETUP[row.label];
      const effect = special?.effect ?? SHORTCUT_EFFECTS[row.label];
      if (!effect) {
        fail('shortcuts', `"${row.label}" has no effect check in qa/audit.ts`);
        continue;
      }
      const run = await openPage(browser, VIEW);
      await load(run.page, url, special?.fixture ?? 'default', `platform=${platform}`);
      await fill(run.page);
      await special?.setup?.(run.page, mod);
      await run.page.locator('#field-body').focus();
      await run.page.keyboard.press(toPlaywright(keys, platform));
      await run.page.waitForTimeout(120);
      if (await effect(run.page)) result.worked.push(row.label);
      else fail('shortcuts', `${platform}: ${row.keys[0]} did not do "${row.label}"`);
      await run.context.close();
    }
    // Tooltips show the shortcut of the control they describe, as the system writes it.
    const tipPage = await openPage(browser, VIEW);
    await load(tipPage.page, url, 'default', `platform=${platform}`);
    await tipPage.page.hover('[aria-label="Use the dark theme"], [aria-label="Use the light theme"]');
    const tip = await tipPage.page.waitForSelector('.tooltip', { timeout: 2000 }).then((el) => el?.textContent(), () => '');
    result.tooltipShowsKeys = platform === 'macos' ? /⌘/.test(tip ?? '') : /Ctrl\+/.test(tip ?? '');
    if (!result.tooltipShowsKeys) fail('shortcuts', `${platform}: the theme button tooltip does not show its shortcut (${tip})`);
    await tipPage.context.close();
    out[platform] = result;
  }
  report.gates.shortcuts = out;
}

// -------------------------------------------------------------- overlay ---
// Keys typed straight after the key that opens an overlay land in it: the overlay
// takes focus in the same turn as the key (build 2 found focus a frame late).

async function overlayGate() {
  const out: NonNullable<Gates['overlay']> = {};
  for (const [platform, mod] of KEY_FAMILIES) {
    const { context, page } = await openPage(browser, VIEW);
    await load(page, url, 'default', `platform=${platform}`);
    await page.locator('#field-body').focus();
    await page.keyboard.press(`${mod}+k`);
    await page.keyboard.type('abo', { delay: 0 });
    const state = await page.evaluate(() => ({ query: document.querySelector<HTMLInputElement>('.palette input')?.value ?? null, body: (document.querySelector('#field-body') as HTMLTextAreaElement).value }));
    out[platform] = state;
    if (state.query !== 'abo' || state.body.includes('abo')) fail('overlay', `${platform}: keys typed after opening the palette went elsewhere: ${JSON.stringify(state)}`);
    await context.close();
  }
  report.gates.overlay = out;
}

// ------------------------------------------------------------------ job ---
// The status bar's job, from the stand-in's fixtures. Cancel is acknowledged at
// once; each failure says the work is safe and its filled button is an action
// that can succeed for its cause; "Copy details" copies the developer text, which
// never appears on screen.

async function jobGate() {
  const out: JobGate = {};
  {
    const { context, page } = await openPage(browser, VIEW);
    await load(page, url, 'job-running');
    await page.keyboard.press('Control+Shift+E');
    await page.waitForSelector('[data-status-bar][data-job="running"]');
    // Acknowledged in the same task as the click: read the state after the task's microtasks
    // (where React applies a discrete update) and before any timer or frame can run.
    const after = await page.evaluate(async () => {
      document.querySelector<HTMLElement>('[data-status-bar] button')?.click();
      for (let i = 0; i < 3; i++) await new Promise<void>((r) => queueMicrotask(() => r()));
      return document.querySelector('[data-status-bar]')?.getAttribute('data-job');
    });
    out.cancelAcknowledged = after;
    if (after !== 'stopped') fail('job', `cancel was not acknowledged at once: the bar says "${after}"`);
    await context.close();
  }
  for (const [fixture, filled] of [
    ['job-failed-OUTPUT_IN_USE', 'Try again'],
    ['job-failed-SOMETHING_NEW', 'Copy details'],
    ['damaged', 'Copy details'],
  ] as const) {
    const { context, page } = await openPage(browser, VIEW);
    await load(page, url, fixture);
    if (fixture !== 'damaged') {
      await page.keyboard.press('Control+Shift+E');
      await page.waitForSelector('[data-status-bar][data-job="failed"]');
    }
    const seen = await page.evaluate(() => ({
      text: document.querySelector('[data-status-text]')?.textContent ?? '',
      filled: [...document.querySelectorAll('[data-status-bar] .btn-primary')].map((b) => (b.textContent ?? '').trim()),
      page: document.body.innerText,
    }));
    if (!/safe/.test(seen.text)) fail('job', `${fixture}: the message does not say the work is safe: "${seen.text}"`);
    if (seen.filled[0] !== filled) fail('job', `${fixture}: the filled button reads ${JSON.stringify(seen.filled)}, expected "${filled}"`);
    await page.getByRole('button', { name: 'Copy details' }).click();
    const copied = await page.evaluate(() => window.__copied.at(-1) ?? '');
    if (!copied) fail('job', `${fixture}: "Copy details" copied nothing`);
    if (copied && seen.page.includes(copied.split('\n')[0] ?? copied)) fail('job', `${fixture}: the developer text is on screen`);
    out[fixture] = { text: seen.text, filled: seen.filled, copiedChars: copied.length };
    await context.close();
  }
  // A second failure of the same kind says so and offers a different step.
  {
    const { context, page } = await openPage(browser, VIEW);
    await load(page, url, 'job-failed-OUTPUT_IN_USE');
    await page.keyboard.press('Control+Shift+E');
    await page.waitForSelector('[data-status-bar][data-job="failed"]');
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.waitForFunction(() => /again/.test(document.querySelector('[data-status-text]')?.textContent ?? ''), null, { timeout: 3000 }).catch(() => {});
    const second = await page.evaluate(() => ({ text: document.querySelector('[data-status-text]')?.textContent ?? '', filled: [...document.querySelectorAll('[data-status-bar] .btn-primary')].map((b) => (b.textContent ?? '').trim()) }));
    out.secondFailure = second;
    if (!/again/.test(second.text) || second.filled[0] === 'Try again') fail('job', `a repeated failure reads the same and offers the same step: ${JSON.stringify(second)}`);
    await context.close();
  }
  report.gates.job = out;
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
  await overlayGate();
  await jobGate();
} catch (error) {
  fail('audit', `the audit itself failed: ${(error instanceof Error ? (error.stack ?? error.message) : String(error)).split('\n').slice(0, 3).join(' ')}`);
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
console.log(`overflow   ${g.overflow ? Object.keys(g.overflow).length : 0} layout cases at ${SIZES.length} sizes, spill and stable checked in each`);
console.log(`restore    ${g.restore ? `reload ${g.restore.restoredAfterReload}, corrupt storage ${g.restore.survivesCorruptStorage}` : 'not run'}`);
console.log(`journeys   ${g.journeys ? Object.entries(g.journeys).map(([id, j]) => `${id} ${j.steps}/${j.stepBudget} steps`).join(', ') : 'not run'}`);
console.log(`shortcuts  ${g.shortcuts ? Object.entries(g.shortcuts).map(([p, r]) => `${p}: ${r.withShortcut} of ${r.commands} commands, ${r.worked.length} worked`).join('; ') : 'not run'}`);
console.log(`overlay    ${g.overlay ? Object.entries(g.overlay).map(([p, r]) => `${p}: typed into the palette "${r.query}"`).join('; ') : 'not run'}`);
console.log(`job        ${g.job ? `cancel acknowledged as "${g.job.cancelAcknowledged}", ${Object.keys(g.job).length - 2} failure fixtures, repeated failure "${g.job.secondFailure?.text ?? ''}"` : 'not run'}`);
if (failures.length) {
  console.error(`\naudit FAILED: ${failures.length} failure(s)`);
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('\naudit passed');
