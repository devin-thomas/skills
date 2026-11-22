// Built from scripts/installed-helpers.ts by scripts/emit-plain-node.ts. Do not edit; change the .ts and run it again.
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
let node_child_process = require("node:child_process");
let node_crypto = require("node:crypto");
node_crypto = __toESM(node_crypto, 1);
let node_fs = require("node:fs");
node_fs = __toESM(node_fs, 1);
let node_os = require("node:os");
node_os = __toESM(node_os, 1);
let node_path = require("node:path");
node_path = __toESM(node_path, 1);
// scripts/installed-helpers.ts
const args = process.argv.slice(2);
const option = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] ?? null : null;
};
const guess = () => {
	const dir = node_path.default.dirname(process.execPath);
	return process.platform === "darwin" ? node_path.default.resolve(dir, "..", "Resources") : node_path.default.join(dir, "resources");
};
const electronResources = process.resourcesPath;
const resources = node_path.default.resolve(option("--resources") ?? (process.versions["electron"] ? electronResources ?? guess() : guess()));
const outFile = option("--out");
const target = `${process.platform}-${process.arch}`;
const binDir = node_path.default.join(resources, "bin", target);
const env = process.platform === "win32" ? {
	SystemRoot: process.env["SystemRoot"] ?? "C:\\Windows",
	PATH: ""
} : { PATH: "" };
const report = {
	at: (/* @__PURE__ */ new Date()).toISOString(),
	runBy: process.versions["electron"] ? `the installed app as Node (Electron ${process.versions["electron"]})` : `node ${process.version}`,
	execPath: process.execPath,
	resources,
	target,
	pathGivenToHelpers: env["PATH"],
	checks: []
};
let failed = false;
function check(name, ok, detail = "") {
	report.checks.push({
		name,
		ok: Boolean(ok),
		detail: String(detail)
	});
	if (!ok) failed = true;
}
const run = (file, argv) => {
	const r = (0, node_child_process.spawnSync)(file, argv, {
		env,
		cwd: node_os.default.tmpdir(),
		encoding: "utf8",
		timeout: 3e4,
		maxBuffer: 16777216,
		windowsHide: true,
		shell: false
	});
	return {
		code: r.status,
		signal: r.signal,
		stdout: r.stdout ?? "",
		stderr: r.stderr ?? "",
		error: r.error ? r.error.message : null
	};
};
const sha256 = (file) => node_crypto.default.createHash("sha256").update(node_fs.default.readFileSync(file)).digest("hex");
let manifest = null;
try {
	manifest = JSON.parse(node_fs.default.readFileSync(node_path.default.join(binDir, "manifest.json"), "utf8"));
	check("manifest.json is inside the app", true, node_path.default.join(binDir, "manifest.json"));
} catch (error) {
	check("manifest.json is inside the app", false, error instanceof Error ? error.message : String(error));
}
for (const entry of manifest?.files ?? []) {
	const file = node_path.default.join(binDir, entry.name);
	const there = node_fs.default.existsSync(file);
	check(`${entry.name} is installed`, there, file);
	if (!there) continue;
	if (process.platform !== "win32") check(`${entry.name} is executable`, (node_fs.default.statSync(file).mode & 73) !== 0);
	if (!manifest?.hashedBeforeSigning) check(`${entry.name} matches the manifest`, sha256(file) === entry.sha256, entry.sha256);
}
const tool = (manifest?.files ?? []).find((f) => f.kind);
if (tool) {
	const answer = run(node_path.default.join(binDir, tool.name), ["--capabilities"]);
	let doc = null;
	try {
		doc = JSON.parse(answer.stdout);
	} catch {}
	report.tool = {
		kind: tool.kind,
		code: answer.code,
		error: answer.error,
		capabilities: doc
	};
	if (tool.kind === "placeholder") check("the placeholder tool answers --capabilities with its placeholder schema", doc?.schema === "example-placeholder", JSON.stringify(doc));
	else check("the tool answers --capabilities from inside the app with PATH emptied", answer.code === 0 && doc && typeof doc.schema === "string", `${answer.code} ${answer.error ?? ""} ${answer.stderr.slice(0, 200)}`);
}
check("the notices file is inside the app", node_fs.default.existsSync(node_path.default.join(resources, "THIRD-PARTY-NOTICES.txt")), node_path.default.join(resources, "THIRD-PARTY-NOTICES.txt"));
report.passed = !failed;
const text = `${report.checks.map((c) => `${c.ok ? "ok    " : "FAILED"} ${c.name}${c.detail ? `: ${c.detail}` : ""}`).join("\n")}\n${failed ? "helpers: FAILED" : "helpers: ok"}\n`;
if (outFile) node_fs.default.writeFileSync(outFile, JSON.stringify(report, null, 2));
process.stdout.write(text);
process.exit(failed ? 1 : 0);
