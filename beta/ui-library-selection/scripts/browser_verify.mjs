#!/usr/bin/env node
/**
 * Parameterized Playwright click-through for UI library work.
 *
 *   node browser_verify.mjs --url URL --out DIR --plan PLAN.json [--video] [--chrome PATH]
 *
 * The plan is a JSON object with a "steps" array. Each step has an "action":
 * goto, wait, click, type, press, hover, scroll, screenshot, move.
 * The script fails if the page raises a pageerror or a console error.
 * It does not decide whether a screenshot looks right; look at the files.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: node browser_verify.mjs --url URL --out DIR --plan PLAN.json [--video] [--chrome PATH]",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = { video: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) usage(`Missing value for ${token}`);
      i += 1;
      return value;
    };
    if (token === "--url") args.url = next();
    else if (token === "--out") args.out = next();
    else if (token === "--plan") args.plan = next();
    else if (token === "--chrome") args.chrome = next();
    else if (token === "--video") args.video = true;
    else if (token === "--help" || token === "-h") usage();
    else usage(`Unknown argument: ${token}`);
  }
  return args;
}

function readPlan(planPath) {
  const raw = fs.readFileSync(planPath, "utf8");
  const plan = JSON.parse(raw);
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error("plan must be a JSON object");
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new Error("plan.steps must be a non-empty array");
  }
  return plan;
}

async function runStep(page, step, outDir) {
  const action = step?.action;
  switch (action) {
    case "goto":
      await page.goto(step.url, { waitUntil: step.waitUntil || "networkidle" });
      break;
    case "wait":
      await page.waitForTimeout(step.ms);
      break;
    case "click":
      await page.locator(step.selector).click();
      break;
    case "type":
      if (step.selector) await page.locator(step.selector).focus();
      await page.keyboard.type(step.text, { delay: step.delay ?? 0 });
      break;
    case "press":
      await page.keyboard.press(step.key);
      break;
    case "hover":
      await page.locator(step.selector).hover();
      break;
    case "scroll":
      await page.locator(step.selector).scrollIntoViewIfNeeded();
      if (step.block) {
        await page.locator(step.selector).evaluate((el, block) => {
          el.scrollIntoView({ block });
        }, step.block);
      }
      break;
    case "screenshot": {
      const file = path.join(outDir, `${step.name}.png`);
      await page.screenshot({ path: file, fullPage: Boolean(step.fullPage) });
      break;
    }
    case "move":
      await page.mouse.move(step.x, step.y);
      break;
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}

export async function run(options) {
  const plan = options.plan;
  const url = options.url || plan.url;
  const outDir = options.out || plan.out;
  if (!url) throw new Error("url is required (--url or plan.url)");
  if (!outDir) throw new Error("out is required (--out or plan.out)");

  fs.mkdirSync(outDir, { recursive: true });
  const errors = [];
  const launchOptions = {};
  if (options.chrome) launchOptions.executablePath = options.chrome;

  const viewport = plan.viewport || { width: 1280, height: 800 };
  const recordVideo = options.video || plan.video
    ? { dir: outDir, size: { width: viewport.width, height: viewport.height } }
    : undefined;

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    recordVideo,
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await page.goto(url, { waitUntil: "networkidle" });
  for (const step of plan.steps) {
    await runStep(page, step, outDir);
  }

  await context.close();
  await browser.close();
  return { errors, out: outDir };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.plan) usage("Missing --plan");
  const plan = readPlan(args.plan);
  const result = await run({
    plan,
    url: args.url || plan.url,
    out: args.out || plan.out,
    video: args.video || Boolean(plan.video),
    chrome: args.chrome || process.env.PLAYWRIGHT_CHROME,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exit(1);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
