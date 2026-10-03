# Agent Native integration

## What is already real

`@uppercut-labs/agent-native@0.1.0` is published and provides `createMcpHandler` for Streamable HTTP.
Use that exact published dependency; no Agent Native release is needed for this package's MCP mount. [R8]

Current docs provide `defineCapability`, `bindCapability`, `executeCapability`, and `runCapabilityCli`.
They require explicit runtime bindings and per-call authorization. The generated CLI requires `--mode` and uses a
`uan.cli-result/v1` envelope. Its current MCP docs describe Streamable HTTP, not an assumed built-in stdio launcher.
Use the actual exported API in the installed published version and test that version. [R9, R10]

## Include in v1

Use the published library as a real implementation dependency for the shared capability registry and executor.
The friendly CLI is a thin argument/output adapter: `add quick-build` supplies the local runtime automatically,
turns positional IDs into typed inputs, and invokes the same services through the capability layer. It should not
require beginners to type a capability identity, a mode flag, or JSON.

Expose `@uppercut-labs/skills/agent-native` as an integration entry point exporting an application-owned registry
factory. Its context supplies explicit filesystem scope, caller, authorization policy, source policy, and native
host-registration port. Merely importing it must not read files, select a home directory, start a listener, or mutate state.

## Proposed capability contract

Namespace: `uppercut.skills`. Contract major version: 1. The names below belong to this new package.

| Capability | Access and scope |
|---|---|
| `catalog.list`, `catalog.show` | Public read of the shipped public catalog only. Remote source reads still obey source policy. |
| `installation.plan`, `installation.inspect`, `installation.doctor` | Protected local reads: can reveal project paths and managed state. |
| `installation.add`, `installation.update` | Protected local writes limited to the selected scope and owned destinations. |
| `installation.remove` | Destructive protected local write; exact capability exposure and independent authorization required. |

A user invoking the ordinary local CLI grants only the requested operation in its resolved target. Internal planning
runs under that same operation authorization; do not add a second human approval for the dependency closure.
An agent calling the programmatic interface needs an explicitly supplied policy/caller from its embedding application.
An identity string or input flag is never proof of permission. Public means the catalog content is public, not that
all local filesystem reads or installations are public tools.

## Thin friendly wrapper, not two business implementations

Keep catalog lookup, source resolution, dependency closure, hashing, conflict checks, and native registration in one
service implementation. Both surfaces use it. Normalize the public friendly CLI into `uppercut.skills.result/v1`;
raw use of the generated Agent Native runner may retain `uan.cli-result/v1`. Do not falsely label these envelopes the same.
Test that their underlying domain results and denial behavior agree.

## MCP boundary

Mount an opt-in, loopback-only Streamable HTTP `POST /mcp` using `createMcpHandler`. Declare
`@modelcontextprotocol/server@2.3.0` as a peer. The mount exposes exactly `catalog.list` and `catalog.show`.
It cannot expose installation planning, inspection, doctor, add, update, or remove because this mount has no bearer
authentication, grant store, destructive allowlist, or stdio launcher. No background daemon or remote deployment is
authorized by this scope change. Ordinary CLI installation does not require starting the MCP listener.

The fixture speaks protocol `2025-11-25`. Accept the current sessionless `2026-07-28` one-POST flow as well;
validate both in an installed-package fixture. Reject non-loopback binds and non-POST requests without leaking local
state. Keep the MCP import isolated from ordinary CLI/catalog imports.

## Dependency and portability checks

Pin the verified Agent Native version. If using its Zod adapter, declare a compatible schema dependency explicitly;
do not depend on a transitive or repository-only devDependency. Install from the published tarball in an external fixture,
not a monorepo symlink. Ordinary catalog/CLI imports must not pull in Astro, Next, DOM, or MCP server setup unnecessarily.
Authorization denial must prevent all handler/filesystem calls; invalid output must be rejected, not printed as success.
