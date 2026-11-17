# Tool contract: example 1.0

The interface between the bundled command-line tool and the app's adapter (`electron/tool/`). It is one of the two seam files written before any builder starts (the other is `src/bridge.ts` with `docs/BRIDGE.md`). Both sides are built against it and neither changes it alone: a change is a lead decision recorded in `docs/DECISIONS.md`.

This is a tiny example so the untouched starter builds, tests and audits. Replace it with the app's real contract, following the desktop-app skill's `references/tool-contract.md`. Build 2's full contract (the media converter, `resample-gui 1.0`) is the worked example.

## Calls

| Call | Arguments | Answer |
| --- | --- | --- |
| Capabilities | `--capabilities` | One JSON object on stdout, exit 0. Never fails because a helper is missing; it reports that |
| Job | `--events 1 --stdin-control -o OUT [-- INPUT ...]`, every path absolute | Newline-delimited JSON events on stdout; exit 0 with `result`, 1 with `error`, 130 with `cancelled` |

## Capabilities

```json
{"schema":"example-capabilities","schema_version":"1.0","tool":"example-tool","tool_version":"0.1.0","events":[1],"features":["events","stdin-control"]}
```

The adapter accepts schema `example-capabilities` with major 1 and `events` including 1. Anything else (no answer within 10 s, not JSON, another schema such as the placeholder's `example-placeholder`) is a damaged installation. Unknown fields are ignored. The answer is cached by the binaries' size and modified time.

## Events

UTF-8, one object per line, `\n` only, no line over 1 MiB. Every event has `type`, `seq` (from 0, by one) and `t_ms`. `hello` is first; exactly one terminal event (`result`, `error` or `cancelled`) is last. Consumers ignore unknown event types and fields. Paths the caller gave are never echoed; inputs are named by their position.

| `type` | Fields |
| --- | --- |
| `hello` | `schema: "example-events"`, `schema_version: "1.0"`, `tool`, `tool_version`, `pid` |
| `start` | `inputs` (count) |
| `stage` | `stage`: `working` then `publishing`; with `working`, `staging` (the staging folder's leaf name) |
| `progress` | `done` and `total` (numbers or null), `fraction` (0 to 1 or null). Never decreasing |
| `result` | `output: { bytes }` |
| `error` | `code`, `message` (English, for a developer), `details` (object) |
| `cancelled` | `reason`: `stdin_closed` or `command` |

## Cancelling and the tool's own children

The adapter keeps the tool's stdin open. End-of-file, or a line that is exactly `cancel`, asks the tool to stop: it stops its own children, removes its staging folder, emits `cancelled` and exits within 2 s. If it has not exited 3 s after the request, the adapter kills it (on Windows `child.kill()`; elsewhere a SIGKILL to its process group).

A tool that starts programs of its own must own them: a kill-on-close job object on Windows, and on macOS and Linux a guardian that kills the child when the tool's pipe to it closes. A closed pipe does not end a child that ignores SIGPIPE (build 2: FFmpeg on all three systems). Kill the tool in a test; do not reason about it.

## Publication

The finished file appears under its name in one step, from a private staging folder beside it named `.example-<32 hex>.tmp`. Without an explicit flag the tool never replaces an existing file, including one that appears while it works.

## Error codes

| Code | Meaning | The page's filled button |
| --- | --- | --- |
| `OUTPUT_IN_USE` | The file to replace is open in another program | Try again |
| `INTERNAL` | Anything else | Copy details |

Codes the adapter makes itself: `TOOL_NOT_FOUND`, `TOOL_INCOMPATIBLE`, `TOOL_CRASHED` (exit without a terminal event), `TOOL_PROTOCOL` (not JSON, a line over 1 MiB, events out of order), `TOOL_STALLED` (no `hello` in 5 s, no capabilities in 10 s). An unknown code from a newer tool gets the page's generic sentence. The tool's text reaches a person only through Copy details.

## The stand-in

`test/standin-tool.cjs` takes these flags and replays a scenario from `test/scenarios/`. Every code in the table above has a scenario, and the adapter's tests run against them on every system (`pnpm test`).
