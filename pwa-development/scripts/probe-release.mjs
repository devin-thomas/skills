#!/usr/bin/env node

import process from "node:process";

const TOOL_VERSION = "1.0.0";

class UsageError extends Error {}

function usage() {
  return [
    "Usage:",
    "  node probe-release.mjs --url <https-url> [--manifest <url-or-path>] [--worker <url-or-path>] [--json]",
    "",
    "Checks deployed HTML, manifest, icons, an optional worker, MIME types, and cache headers.",
    "It does not install the app, execute the worker lifecycle, or prove offline behavior."
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
    } else if (["--url", "--manifest", "--worker"].includes(argument)) {
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
  if (!options.help && !options.url) {
    throw new UsageError("--url is required");
  }
  return options;
}

function makeFinding(level, code, message, location) {
  return location ? { level, code, message, location } : { level, code, message };
}

function isLocalhost(url) {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

function responseHeaders(response) {
  return Object.fromEntries([...response.headers.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

async function fetchResource(url, kind, findings) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "cache-control": "no-cache", pragma: "no-cache" }
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const record = {
      kind,
      requestedUrl: url.href,
      finalUrl: response.url,
      status: response.status,
      ok: response.ok,
      bytes: bytes.length,
      headers: responseHeaders(response)
    };
    if (!response.ok) {
      findings.push(makeFinding("error", `${kind}.status`, `HTTP ${response.status}`, response.url));
    }
    if (bytes.length === 0) {
      findings.push(makeFinding("error", `${kind}.empty`, "Response body is empty.", response.url));
    }
    return { record, bytes, text: bytes.toString("utf8") };
  } catch (error) {
    findings.push(makeFinding("error", `${kind}.fetch`, error.message, url.href));
    return null;
  }
}

function tagsNamed(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "giu")) ?? [];
}

function attributes(tag) {
  const result = {};
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu;
  for (const match of tag.matchAll(pattern)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return result;
}

function discoverManifest(html) {
  for (const tag of tagsNamed(html, "link")) {
    const values = attributes(tag);
    const rel = (values.rel ?? "").toLowerCase().split(/\s+/u);
    if (rel.includes("manifest") && values.href) {
      return values.href;
    }
  }
  return null;
}

function contentType(resource) {
  return resource?.record.headers["content-type"]?.toLowerCase() ?? "";
}

function looksLikeHtml(resource) {
  return contentType(resource).includes("text/html") || /^\s*<!doctype html|^\s*<html\b/iu.test(resource?.text ?? "");
}

function warnImmutable(resource, kind, findings) {
  const cacheControl = resource?.record.headers["cache-control"]?.toLowerCase() ?? "";
  if (cacheControl.includes("immutable")) {
    findings.push(makeFinding("warning", `${kind}.immutable`, `${kind} is marked immutable and may hide updates.`, resource.record.finalUrl));
  }
}

function urlPathWithinScope(candidate, scope) {
  if (candidate.origin !== scope.origin) {
    return false;
  }
  const scopePath = scope.pathname.endsWith("/") ? scope.pathname : `${scope.pathname}/`;
  return candidate.pathname === scope.pathname || candidate.pathname.startsWith(scopePath);
}

function validateManifestShape(manifest, manifestUrl, findings, location) {
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    findings.push(makeFinding("error", "manifest.type", "Manifest root must be a JSON object.", location));
    return { icons: [], startUrl: null, scopeUrl: null };
  }
  if (typeof manifest.name !== "string" && typeof manifest.short_name !== "string") {
    findings.push(makeFinding("error", "manifest.name", "Manifest has neither name nor short_name.", location));
  }
  if (typeof manifest.short_name !== "string") {
    findings.push(makeFinding("warning", "manifest.short-name", "Manifest has no short_name for constrained launcher labels.", location));
  }
  let startUrl = null;
  if (typeof manifest.start_url !== "string") {
    findings.push(makeFinding("error", "manifest.start-url", "Manifest has no start_url.", location));
  } else {
    try {
      startUrl = new URL(manifest.start_url, manifestUrl);
    } catch {
      findings.push(makeFinding("error", "manifest.start-url-invalid", "Manifest start_url is not a valid URL reference.", location));
    }
  }
  if (typeof manifest.id !== "string") {
    findings.push(makeFinding("warning", "manifest.id", "Manifest has no explicit stable id.", location));
  }
  let scopeUrl = null;
  if (typeof manifest.scope !== "string") {
    findings.push(makeFinding("warning", "manifest.scope", "Manifest has no explicit scope.", location));
  } else {
    try {
      scopeUrl = new URL(manifest.scope, manifestUrl);
    } catch {
      findings.push(makeFinding("error", "manifest.scope-invalid", "Manifest scope is not a valid URL reference.", location));
    }
  }
  if (startUrl && scopeUrl && !urlPathWithinScope(startUrl, scopeUrl)) {
    findings.push(makeFinding("error", "manifest.start-outside-scope", "Manifest start_url resolves outside scope.", location));
  }
  if (typeof manifest.display !== "string") {
    findings.push(makeFinding("warning", "manifest.display", "Manifest has no explicit display mode.", location));
  }
  for (const field of ["theme_color", "background_color"]) {
    if (typeof manifest[field] !== "string") {
      findings.push(makeFinding("warning", `manifest.${field.replace("_", "-")}`, `Manifest has no ${field}.`, location));
    }
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    findings.push(makeFinding("error", "manifest.icons", "Manifest has no icons.", location));
    return { icons: [], startUrl, scopeUrl };
  }
  return {
    icons: manifest.icons.filter((icon) => icon && typeof icon.src === "string"),
    startUrl,
    scopeUrl
  };
}

async function probeRelease(options) {
  const findings = [];
  const resources = [];
  let pageUrl;
  try {
    pageUrl = new URL(options.url);
  } catch {
    findings.push(makeFinding("error", "page.url", "--url must be an absolute URL.", options.url));
    return buildResult(options.url, resources, findings);
  }
  if (pageUrl.protocol !== "https:" && !isLocalhost(pageUrl)) {
    findings.push(makeFinding("error", "page.https", "A deployed PWA must use HTTPS; localhost is the development exception.", pageUrl.href));
  }

  const page = await fetchResource(pageUrl, "page", findings);
  if (!page) {
    return buildResult(pageUrl.href, resources, findings);
  }
  resources.push(page.record);
  if (!contentType(page).includes("text/html")) {
    findings.push(makeFinding("warning", "page.content-type", `Expected HTML content type, received '${contentType(page) || "missing"}'.`, page.record.finalUrl));
  }
  warnImmutable(page, "page", findings);

  const manifestReference = options.manifest ?? discoverManifest(page.text);
  if (!manifestReference) {
    findings.push(makeFinding("error", "manifest.link", "No manifest link was discovered; pass --manifest to probe an explicit URL.", page.record.finalUrl));
  } else {
    let manifestUrl;
    try {
      manifestUrl = new URL(manifestReference, page.record.finalUrl);
    } catch {
      findings.push(makeFinding("error", "manifest.url", "Manifest reference is not a valid URL.", manifestReference));
    }
    if (manifestUrl) {
      const manifestResource = await fetchResource(manifestUrl, "manifest", findings);
      if (manifestResource) {
        resources.push(manifestResource.record);
        if (new URL(manifestResource.record.finalUrl).origin !== new URL(page.record.finalUrl).origin) {
          findings.push(makeFinding("warning", "manifest.cross-origin", "Manifest resolved to another origin; this probe does not enforce browser CORS/credentials behavior.", manifestResource.record.finalUrl));
        }
        if (looksLikeHtml(manifestResource)) {
          findings.push(makeFinding("error", "manifest.html-fallback", "Manifest response is HTML, likely a catch-all fallback.", manifestResource.record.finalUrl));
        }
        const type = contentType(manifestResource);
        if (!type.includes("application/manifest+json") && !type.includes("application/json")) {
          findings.push(makeFinding("warning", "manifest.content-type", `Unexpected manifest content type '${type || "missing"}'.`, manifestResource.record.finalUrl));
        }
        warnImmutable(manifestResource, "manifest", findings);
        let manifest;
        try {
          manifest = JSON.parse(manifestResource.text);
        } catch (error) {
          findings.push(makeFinding("error", "manifest.json", error.message, manifestResource.record.finalUrl));
        }
        if (manifest) {
          const shape = validateManifestShape(manifest, manifestResource.record.finalUrl, findings, manifestResource.record.finalUrl);
          if (shape.startUrl) {
            if (shape.startUrl.origin !== new URL(page.record.finalUrl).origin) {
              findings.push(makeFinding("error", "start-url.cross-origin", "Manifest start_url must resolve to the page origin; it was not fetched.", shape.startUrl.href));
            } else {
              const launchResource = await fetchResource(shape.startUrl, "start-url", findings);
              if (launchResource) {
                resources.push(launchResource.record);
                if (!contentType(launchResource).includes("text/html")) {
                  findings.push(makeFinding("warning", "start-url.content-type", `Expected HTML content type, received '${contentType(launchResource) || "missing"}'.`, launchResource.record.finalUrl));
                }
                warnImmutable(launchResource, "start-url", findings);
                if (shape.scopeUrl && !urlPathWithinScope(new URL(launchResource.record.finalUrl), shape.scopeUrl)) {
                  findings.push(makeFinding("warning", "start-url.redirected-outside-scope", "The launch URL redirected outside manifest scope; verify the authenticated installed flow.", launchResource.record.finalUrl));
                }
              }
            }
          }
          const icons = shape.icons;
          const limitedIcons = icons.slice(0, 16);
          if (icons.length > limitedIcons.length) {
            findings.push(makeFinding("warning", "icons.limit", `Probing the first ${limitedIcons.length} of ${icons.length} icons.`, manifestResource.record.finalUrl));
          }
          const iconResults = await Promise.all(limitedIcons.map(async (icon, index) => {
            let iconUrl;
            try {
              iconUrl = new URL(icon.src, manifestResource.record.finalUrl);
            } catch {
              findings.push(makeFinding("error", "icon.url", "Icon src is not a valid URL reference.", icon.src));
              return null;
            }
            if (!["http:", "https:"].includes(iconUrl.protocol)) {
              findings.push(makeFinding("error", "icon.protocol", `Unsupported icon URL protocol '${iconUrl.protocol}'.`, iconUrl.href));
              return null;
            }
            if (iconUrl.origin !== new URL(manifestResource.record.finalUrl).origin) {
              findings.push(makeFinding("warning", "icon.cross-origin", "Cross-origin icon was not fetched by this helper; validate it separately with browser CORS behavior.", iconUrl.href));
              return null;
            }
            const iconResource = await fetchResource(iconUrl, `icon-${index}`, findings);
            if (!iconResource) return null;
            if (looksLikeHtml(iconResource)) {
              findings.push(makeFinding("error", "icon.html-fallback", "Icon response is HTML, likely a catch-all fallback.", iconResource.record.finalUrl));
            }
            if (!contentType(iconResource).startsWith("image/")) {
              findings.push(makeFinding("warning", "icon.content-type", `Unexpected icon content type '${contentType(iconResource) || "missing"}'.`, iconResource.record.finalUrl));
            }
            return iconResource.record;
          }));
          resources.push(...iconResults.filter(Boolean));
        }
      }
    }
  }

  if (options.worker) {
    let workerUrl;
    try {
      workerUrl = new URL(options.worker, page.record.finalUrl);
    } catch {
      findings.push(makeFinding("error", "worker.url", "Worker reference is not a valid URL.", options.worker));
    }
    if (workerUrl) {
      if (workerUrl.origin !== new URL(page.record.finalUrl).origin) {
        findings.push(makeFinding("error", "worker.cross-origin", "A service worker must be served from the page origin.", workerUrl.href));
        workerUrl = null;
      }
    }
    if (workerUrl) {
      const worker = await fetchResource(workerUrl, "worker", findings);
      if (worker) {
        resources.push(worker.record);
        if (looksLikeHtml(worker)) {
          findings.push(makeFinding("error", "worker.html-fallback", "Worker response is HTML, likely a catch-all fallback.", worker.record.finalUrl));
        }
        const type = contentType(worker);
        if (!type.includes("javascript") && !type.includes("ecmascript")) {
          findings.push(makeFinding("warning", "worker.content-type", `Unexpected worker content type '${type || "missing"}'.`, worker.record.finalUrl));
        }
        warnImmutable(worker, "worker", findings);
        if (!worker.record.headers["cache-control"]) {
          findings.push(makeFinding("warning", "worker.cache-control", "Worker has no explicit Cache-Control header.", worker.record.finalUrl));
        }
      }
    }
  } else {
    findings.push(makeFinding("warning", "worker.not-probed", "No worker URL was supplied; service-worker response headers were not checked."));
  }

  return buildResult(pageUrl.href, resources, findings);
}

function buildResult(url, resources, findings) {
  const errors = findings.filter((finding) => finding.level === "error").length;
  const warnings = findings.filter((finding) => finding.level === "warning").length;
  return {
    tool: "pwa-development/probe-release",
    version: TOOL_VERSION,
    url,
    status: errors === 0 ? "pass" : "fail",
    summary: { errors, warnings, resources: resources.length },
    resources,
    findings,
    limitations: [
      "HTTP and metadata probe only.",
      "Does not install the app, execute the service-worker lifecycle, prove offline behavior, or inspect launcher rendering."
    ]
  };
}

function printHuman(result) {
  console.log(`PWA release probe: ${result.status.toUpperCase()}`);
  console.log(`URL: ${result.url}`);
  console.log(`Resources: ${result.summary.resources}; errors: ${result.summary.errors}; warnings: ${result.summary.warnings}`);
  for (const finding of result.findings) {
    const where = finding.location ? ` (${finding.location})` : "";
    console.log(`[${finding.level.toUpperCase()}] ${finding.code}: ${finding.message}${where}`);
  }
  console.log("Limit: HTTP metadata only; no install, worker lifecycle, offline, or device acceptance.");
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
  const result = await probeRelease(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
  process.exitCode = result.status === "pass" ? 0 : 1;
}

await main();
