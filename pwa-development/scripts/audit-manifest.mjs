#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const TOOL_VERSION = "1.0.0";
const DISPLAY_MODES = new Set([
  "browser",
  "fullscreen",
  "minimal-ui",
  "standalone",
  "window-controls-overlay",
  "tabbed",
  "borderless"
]);

class UsageError extends Error {}

function usage() {
  return [
    "Usage:",
    "  node audit-manifest.mjs --manifest <path> [--root <public-root>] [--json]",
    "",
    "Checks a dependency-free operational manifest baseline and referenced local icon files.",
    "It does not prove browser installability, launcher rendering, or runtime behavior."
  ].join("\n");
}

function parseArgs(argv) {
  const options = { json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      options.json = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--manifest" || argument === "--root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new UsageError(`Missing value for ${argument}`);
      }
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new UsageError(`Unknown argument: ${argument}`);
    }
  }
  if (!options.help && !options.manifest) {
    throw new UsageError("--manifest is required");
  }
  return options;
}

function makeFinding(level, code, message, location) {
  return location ? { level, code, message, location } : { level, code, message };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function purposeTokens(icon) {
  if (typeof icon.purpose !== "string" || icon.purpose.trim() === "") {
    return ["any"];
  }
  return icon.purpose.trim().split(/\s+/u);
}

function sizeTokens(icon) {
  if (typeof icon.sizes !== "string") {
    return [];
  }
  return icon.sizes.trim().split(/\s+/u).filter(Boolean);
}

function pathIsInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveLocalIcon(iconSource, manifestDirectory, publicRoot) {
  if (/^(?:data:|https?:)/iu.test(iconSource)) {
    return null;
  }
  const withoutQuery = iconSource.split(/[?#]/u, 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    decoded = withoutQuery;
  }
  return decoded.startsWith("/")
    ? path.resolve(publicRoot, decoded.replace(/^[/\\]+/u, ""))
    : path.resolve(manifestDirectory, decoded);
}

function urlWithinScope(startUrl, scope) {
  try {
    const base = new URL("https://pwa.invalid/manifest.webmanifest");
    const resolvedStart = new URL(startUrl, base);
    const resolvedScope = new URL(scope, base);
    if (resolvedStart.origin !== resolvedScope.origin) {
      return false;
    }
    const scopePath = resolvedScope.pathname.endsWith("/")
      ? resolvedScope.pathname
      : `${resolvedScope.pathname}/`;
    return resolvedStart.pathname === resolvedScope.pathname || resolvedStart.pathname.startsWith(scopePath);
  } catch {
    return null;
  }
}

async function auditManifest(options) {
  const manifestPath = path.resolve(options.manifest);
  const manifestDirectory = path.dirname(manifestPath);
  const publicRoot = path.resolve(options.root ?? manifestDirectory);
  const findings = [];
  let manifest;

  try {
    const raw = await readFile(manifestPath, "utf8");
    manifest = JSON.parse(raw);
  } catch (error) {
    findings.push(makeFinding("error", "manifest.read", error.message, manifestPath));
    return buildResult(manifestPath, publicRoot, findings);
  }

  if (!isRecord(manifest)) {
    findings.push(makeFinding("error", "manifest.type", "Manifest root must be a JSON object."));
    return buildResult(manifestPath, publicRoot, findings);
  }

  if (typeof manifest.name !== "string" && typeof manifest.short_name !== "string") {
    findings.push(makeFinding("error", "identity.name", "Define name or short_name for an intentional installed identity."));
  }
  if (typeof manifest.name !== "string") {
    findings.push(makeFinding("warning", "identity.full-name", "A full name is recommended for install surfaces that have room."));
  }
  if (typeof manifest.short_name !== "string") {
    findings.push(makeFinding("warning", "identity.short-name", "A short_name is recommended for constrained launcher labels."));
  }
  if (typeof manifest.id !== "string" || manifest.id.trim() === "") {
    findings.push(makeFinding("warning", "identity.id", "Define a stable id; changing it later can create a separate installed app."));
  }
  if (typeof manifest.start_url !== "string" || manifest.start_url.trim() === "") {
    findings.push(makeFinding("error", "launch.start-url", "Define start_url for the intended launch route."));
  }
  if (typeof manifest.scope !== "string" || manifest.scope.trim() === "") {
    findings.push(makeFinding("warning", "launch.scope", "Define scope explicitly so navigation boundaries are intentional."));
  }
  if (typeof manifest.start_url === "string" && typeof manifest.scope === "string") {
    const withinScope = urlWithinScope(manifest.start_url, manifest.scope);
    if (withinScope === false) {
      findings.push(makeFinding("error", "launch.outside-scope", "start_url resolves outside scope."));
    } else if (withinScope === null) {
      findings.push(makeFinding("error", "launch.invalid-url", "start_url or scope is not a valid URL reference."));
    }
  }

  if (typeof manifest.display !== "string") {
    findings.push(makeFinding("warning", "display.missing", "Define display for an intentional installed presentation."));
  } else if (!DISPLAY_MODES.has(manifest.display)) {
    findings.push(makeFinding("error", "display.invalid", `Unrecognized display mode: ${manifest.display}`));
  }
  if (manifest.display_override !== undefined) {
    if (!Array.isArray(manifest.display_override) || manifest.display_override.some((value) => typeof value !== "string")) {
      findings.push(makeFinding("error", "display.override", "display_override must be an array of strings."));
    }
  }
  for (const colorField of ["theme_color", "background_color"]) {
    if (typeof manifest[colorField] !== "string" || manifest[colorField].trim() === "") {
      findings.push(makeFinding("warning", `color.${colorField}`, `Define ${colorField} for coherent browser and launch presentation.`));
    }
  }

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  if (icons.length === 0) {
    findings.push(makeFinding("error", "icons.missing", "Define at least one manifest icon."));
  }

  const inventory = { any: new Set(), maskable: new Set() };
  for (let index = 0; index < icons.length; index += 1) {
    const icon = icons[index];
    const location = `icons[${index}]`;
    if (!isRecord(icon)) {
      findings.push(makeFinding("error", "icons.type", "Icon entry must be an object.", location));
      continue;
    }
    if (typeof icon.src !== "string" || icon.src.trim() === "") {
      findings.push(makeFinding("error", "icons.src", "Icon src is required.", location));
      continue;
    }
    const purposes = purposeTokens(icon);
    const sizes = sizeTokens(icon);
    const invalidSizes = sizes.filter((size) => size !== "any" && !/^\d+x\d+$/u.test(size));
    if (sizes.length === 0) {
      findings.push(makeFinding("warning", "icons.sizes", "Declare icon sizes so user agents can select assets reliably.", location));
    }
    if (invalidSizes.length > 0) {
      findings.push(makeFinding("error", "icons.invalid-sizes", `Invalid sizes token(s): ${invalidSizes.join(", ")}`, location));
    }
    if (purposes.includes("any") && purposes.includes("maskable")) {
      findings.push(makeFinding("warning", "icons.combined-purpose", "Prefer separate any and maskable compositions.", location));
    }
    for (const purpose of purposes) {
      if (purpose === "any" || purpose === "maskable") {
        sizes.forEach((size) => inventory[purpose].add(size));
      }
    }

    const localPath = resolveLocalIcon(icon.src, manifestDirectory, publicRoot);
    if (localPath) {
      if (!pathIsInside(publicRoot, localPath)) {
        findings.push(makeFinding("warning", "icons.outside-root", "Local icon resolves outside the declared public root.", localPath));
      } else {
        try {
          const file = await stat(localPath);
          if (!file.isFile() || file.size === 0) {
            findings.push(makeFinding("error", "icons.empty", "Referenced icon is not a non-empty file.", localPath));
          }
        } catch {
          findings.push(makeFinding("error", "icons.not-found", "Referenced local icon does not exist.", localPath));
        }
      }
    }
  }

  for (const requiredSize of ["192x192", "512x512"]) {
    if (!inventory.any.has(requiredSize)) {
      findings.push(makeFinding("warning", "icons.any-baseline", `No ordinary any icon declares ${requiredSize}.`));
    }
    if (!inventory.maskable.has(requiredSize)) {
      findings.push(makeFinding("warning", "icons.maskable-baseline", `No separate maskable icon declares ${requiredSize}.`));
    }
  }

  return buildResult(manifestPath, publicRoot, findings);
}

function buildResult(manifestPath, publicRoot, findings) {
  const errors = findings.filter((finding) => finding.level === "error").length;
  const warnings = findings.filter((finding) => finding.level === "warning").length;
  return {
    tool: "pwa-development/audit-manifest",
    version: TOOL_VERSION,
    manifest: manifestPath,
    publicRoot,
    status: errors === 0 ? "pass" : "fail",
    summary: { errors, warnings },
    findings,
    limitations: [
      "Operational baseline, not a complete Web Application Manifest conformance test.",
      "Does not prove browser installability, decoded pixel dimensions, mask safety, or launcher rendering."
    ]
  };
}

function printHuman(result) {
  console.log(`PWA manifest audit: ${result.status.toUpperCase()}`);
  console.log(`Manifest: ${result.manifest}`);
  console.log(`Public root: ${result.publicRoot}`);
  console.log(`Errors: ${result.summary.errors}; warnings: ${result.summary.warnings}`);
  for (const finding of result.findings) {
    const where = finding.location ? ` (${finding.location})` : "";
    console.log(`[${finding.level.toUpperCase()}] ${finding.code}: ${finding.message}${where}`);
  }
  console.log("Limit: this does not prove installability or installed-surface behavior.");
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(error.message);
      console.error(usage());
      process.exitCode = 2;
      return;
    }
    throw error;
  }
  if (options.help) {
    console.log(usage());
    return;
  }
  const result = await auditManifest(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
  process.exitCode = result.status === "pass" ? 0 : 1;
}

await main();
