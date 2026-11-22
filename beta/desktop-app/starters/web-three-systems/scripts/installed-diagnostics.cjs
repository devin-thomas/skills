// Built from scripts/installed-diagnostics.ts by scripts/emit-plain-node.ts. Do not edit; change the .ts and run it again.
// \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
let node_fs = require("node:fs");
node_fs = __toESM(node_fs, 1);
let node_path = require("node:path");
node_path = __toESM(node_path, 1);
// scripts/installed-diagnostics.ts
const [file, root, summary] = process.argv.slice(2);
const lines = [];
let failed = false;
const say = (line) => lines.push(line);
const fail = (line) => {
	failed = true;
	lines.push(`FAILED: ${line}`);
};
const norm = (p) => {
	let real = node_path.default.resolve(p);
	try {
		real = node_fs.default.realpathSync(real);
	} catch {}
	return process.platform === "win32" || process.platform === "darwin" ? real.toLowerCase() : real;
};
const inside = (p) => norm(p).startsWith(norm(root ?? "") + node_path.default.sep);
let d;
try {
	if (!file || !root) throw new Error("usage: installed-diagnostics.cjs <diagnostics.json> <install root> [summary file]");
	d = JSON.parse(node_fs.default.readFileSync(file, "utf8"));
} catch (error) {
	console.error(`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(2);
}
say(`app ${d.app ?? "?"}, Electron ${d.electron ?? "?"}, Chromium ${d.chrome ?? "?"}, process ${d.pid ?? "?"}`);
if (typeof d.exe === "string") {
	if (inside(d.exe)) say(`running from the installed location: ${d.exe}`);
	else fail(`the running app is ${d.exe}, which is not inside ${root}`);
} else say("running location: not reported by this build");
if (d.packaged === true) say("packaged build: yes");
else if (d.packaged === false) fail("the running app is not a packaged build");
if (d.userData) say(`data folder: ${d.userData}`);
if (d.window) say(`window: visible ${d.window.visible}, focused ${d.window.focused}, ${d.window.bounds ? `${d.window.bounds.width}x${d.window.bounds.height} at ${d.window.bounds.x},${d.window.bounds.y}` : "bounds not reported"}`);
else say("window: not reported by this build");
const life = d.shell?.lifecycle;
if (life && typeof life.secondLaunches === "number") {
	if (life.secondLaunches === 0) say(`reached through the control channel only: ${life.controlRequests ?? "?"} requests, 0 second launches`);
	else fail(`the app counted ${life.secondLaunches} second launch(es); a check must reach it only through its control channel`);
} else say("second launches: not reported by this build");
const env = d.env ?? d.environment ?? null;
if (env && ("PATH" in env || "Path" in env)) say(`PATH seen by the app: '${env["PATH"] ?? env["Path"]}'`);
else say("PATH seen by the app: not reported by this build");
const config = JSON.parse(node_fs.default.readFileSync(node_path.default.join(node_path.default.dirname(process.argv[1] ?? "."), "..", "app.config.json"), "utf8"));
const NAMES = config.tool.binaries ?? [config.tool.name];
const KEYS = /* @__PURE__ */ new Set([
	"tool",
	"toolSource",
	"helpers",
	...NAMES
]);
const found = [];
(function walk(value, trail) {
	if (!value || typeof value !== "object" || trail.length > 6) return;
	const record = value;
	if (!Array.isArray(value) && Object.keys(record).some((k) => KEYS.has(k) && record[k] !== null && record[k] !== void 0)) found.push([trail.join(".") || "(top level)", Object.fromEntries(Object.entries(record).filter(([k]) => KEYS.has(k)))]);
	for (const [k, v] of Object.entries(record)) if (!KEYS.has(k)) walk(v, [...trail, k]);
})(d, []);
if (found.length === 0) say("the tool and its helpers: not reported by this build");
else {
	const escape = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const HELPER = new RegExp(`(^|[\\\\/])(${NAMES.map(escape).join("|")})(\\.exe)?$`, "i");
	for (const [where, block] of found) {
		say(`tool report at ${where}: ${JSON.stringify(block)}`);
		(function paths(value) {
			if (typeof value === "string") {
				if (node_path.default.isAbsolute(value) && HELPER.test(value)) {
					if (inside(value)) say(`  inside the app: ${value}`);
					else fail(`${value} is outside the installed app`);
				}
			} else if (value && typeof value === "object") for (const v of Object.values(value)) paths(v);
		})(block);
		const sources = JSON.stringify(block).match(/"source":"(path|beside|flag|packaged|development|override)"/g) ?? [];
		if (sources.some((s) => /"(path|development|override)"/.test(s))) fail(`a helper was not taken from the app bundle: ${sources.join(", ")}`);
	}
}
say(failed ? "diagnostics: FAILED" : "diagnostics: ok");
const text = `${lines.join("\n")}\n`;
if (summary) node_fs.default.writeFileSync(summary, text);
else process.stdout.write(text);
process.exit(failed ? 1 : 0);
