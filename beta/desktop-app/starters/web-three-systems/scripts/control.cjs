// Built from scripts/control.ts by scripts/emit-plain-node.ts. Do not edit; change the .ts and run it again.
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
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
let node_path = require("node:path");
node_path = __toESM(node_path, 1);
let node_fs = require("node:fs");
node_fs = __toESM(node_fs, 1);
let node_net = require("node:net");
node_net = __toESM(node_net, 1);
const INFO_FILE = "control.json";
/** The file in the data folder that says where the running app listens. */
const infoPath = (userData) => node_path.default.join(userData, INFO_FILE);
/** What control.json says, or null when there is none or it is not this version's. */
function readInfo(userData) {
	try {
		const info = JSON.parse(node_fs.default.readFileSync(infoPath(userData), "utf8"));
		if (info === null || typeof info !== "object") return null;
		const { v, endpoint: where, pid } = info;
		return v === 1 && typeof where === "string" ? {
			v,
			endpoint: where,
			...typeof pid === "number" ? { pid } : {}
		} : null;
	} catch {
		return null;
	}
}
const codeOf = (error) => {
	const code = error instanceof Error ? error.code : void 0;
	return typeof code === "string" ? code : void 0;
};
function once(where, argv, cwd, timeoutMs) {
	return new Promise((resolve) => {
		let settled = false;
		let text = "";
		const socket = node_net.default.connect(where);
		const finish = (value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			socket.destroy();
			resolve(value);
		};
		const timer = setTimeout(() => finish({
			v: 1,
			ok: false,
			error: `no reply in ${timeoutMs} ms`,
			retry: false
		}), timeoutMs);
		socket.setEncoding("utf8");
		socket.on("connect", () => socket.write(`${JSON.stringify({
			v: 1,
			argv,
			cwd
		})}\n`));
		socket.on("data", (chunk) => {
			text += chunk;
			const end = text.indexOf("\n");
			if (end === -1) return;
			try {
				finish({
					...JSON.parse(text.slice(0, end)),
					retry: false
				});
			} catch {
				finish({
					v: 1,
					ok: false,
					error: "the reply was not JSON",
					retry: false
				});
			}
		});
		socket.on("error", (error) => finish({
			v: 1,
			ok: false,
			error: `${codeOf(error) ?? error.message}`,
			retry: true
		}));
		socket.on("close", () => finish({
			v: 1,
			ok: false,
			error: "closed without a reply",
			retry: false
		}));
	});
}
/**
* Send one request to the app running with this data folder. Resolves to the app's reply, or to
* { ok: false, answered: false, error } when no app answered. Never rejects.
*/
async function send$1(userData, argv, { cwd = process.cwd(), waitMs = 2e4, timeoutMs = 6e4 } = {}) {
	const until = Date.now() + waitMs;
	let last = "no control.json in the data folder";
	for (;;) {
		const info = readInfo(userData);
		if (info) {
			const { retry, ...reply } = await once(info.endpoint, argv, cwd, timeoutMs);
			if (!retry) return {
				...reply,
				answered: reply.ok || !/^(ENOENT|ECONNREFUSED|EPIPE)/.test(reply.error ?? "")
			};
			last = `${reply.error} at ${info.endpoint}`;
		}
		if (Date.now() >= until) return {
			v: 1,
			ok: false,
			answered: false,
			error: `no running app answers for ${userData}: ${last}`
		};
		await new Promise((r) => setTimeout(r, 200));
	}
}
// scripts/control.ts
/** One request; the timeout a script allows is longer than the package's default. */
function send(dataDir, argv, { waitMs = 2e4, timeoutMs = 12e4 } = {}) {
	return send$1(dataDir, argv, {
		waitMs,
		timeoutMs
	});
}
if (/[\\/]control\.(ts|cjs)$/.test(process.argv[1] ?? "")) {
	const argv = process.argv.slice(2);
	const split = argv.indexOf("--");
	const own = split === -1 ? argv : argv.slice(0, split);
	const request = split === -1 ? [] : argv.slice(split + 1);
	const opt = (name, fallback) => {
		const i = own.indexOf(`--${name}`);
		return i === -1 ? fallback : own[i + 1];
	};
	const dataDir = opt("data-dir");
	if (!dataDir) {
		process.stderr.write("usage: control.cjs --data-dir <folder> [--wait <seconds>] [--timeout <seconds>] -- <command flags>\n");
		process.exit(64);
	}
	send(node_path.default.resolve(dataDir), request, {
		waitMs: Number(opt("wait", "20")) * 1e3,
		timeoutMs: Number(opt("timeout", "120")) * 1e3
	}).then((reply) => {
		process.stdout.write(`${JSON.stringify(reply)}\n`);
		process.exit(reply.ok ? 0 : reply.answered ? 1 : 2);
	});
}
exports.send = send;
