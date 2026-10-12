# Uppercut Skills plan

Status: product decisions reconciled from two plans and the user's later Grok host clarification; installer not yet implemented.
Mode: standalone Quick Build in the existing skills repository. See [reconciliation](RECONCILIATION-2026-10-03.md).

## Intended result

A person or agent names an owned public skill and gets the complete usable skill in the right host,
including its required sibling skills, without learning the repository structure or dependency graph.
The human-facing CLI is `npx @uppercut-labs/skills`; its executable is `uppercut-skills`.
The existing `manifest/skills.json` remains the authoring catalog. Do not create a competing registry.

## First use

Proposed behavior, not a command shipped by this pack:

```sh
npx @uppercut-labs/skills add quick-build
npx @uppercut-labs/skills add execute-task-cycles --latest
```

Resolve the host automatically. Install project-locally by default. Installing `execute-task-cycles`
includes `execute-task` in the same transaction, without an additional question or approval step.
An empty installation is normal: `list` shows the catalog; `doctor` explains that no skills are managed yet.
No login, web dashboard, provider key, MCP setup, or separate database is needed for ordinary local use.
An opt-in read-only loopback MCP mount is included in the later implementation scope; it serves only public catalog
list/show through `POST /mcp` and does not change the default local install flow.

## Devices and evidence

The installer targets Node.js 22+ on Windows, macOS, and Linux. Host availability is separate from installer OS support.
All six hosts are in v1: Codex, Claude Code, Cursor, Antigravity, Grok Bot, and Grok CLI.
Native discovery and one safe invocation must be recorded in each actual supported host, with its version,
execution computer, scope, and evidence. Filesystem fixtures do not satisfy this gate.
For Grok Bot, repository work uses the Bot's `.agents/skills` route reported by the user's Bot, while its
chat-wide private library needs native account registration. Neither is inferred from files on the laptop displaying
the chat. Grok CLI uses documented `.grok/skills` routes and is accepted separately. See [HOSTS](HOSTS.md),
[GROKBOT](GROKBOT.md), and [GROK-CLI](GROK-CLI.md).

## Included

The commands `list`, `show`, `add`, `update`, `remove`, and `doctor`; readable output plus structured JSON;
automatic dependency closure; complete content bundles; immutable source receipts; remembered stable/GitHub
channels; safe updates and removal; local conflict protection; explicit project/global scope; all six host
adapters; and a shared typed Agent Native capability layer with a programmatic integration entry point.

Reuse the owned catalog: 13 local skill directories plus three owned entries sourced from
Starter Pack and VidChopper. Their external resource closures and licenses need auditing before distribution.
"Our catalog only" does not mean an arbitrary third-party GitHub/URL installer.

## Outside this build

No public marketplace, arbitrary URL/repository input, private skill distribution, paid accounts, telemetry,
background auto-updates, provider API calls, model execution, global machine setup, or new public server.
No forced conversion of skills into Cursor rules or Antigravity workflows. No npm package per skill.
Agent Native does not make a skill discoverable in a host by itself.

## Delivery sequence

1. Apply narrow portability fixes; build on the existing catalog; resolve all six host contracts early.
2. Ship the smallest local add flow with automatic dependencies, then source channels, update/remove, and diagnosis.
3. Integrate the same service functions with Agent Native, verify installed tarballs and all six real hosts,
   and prepare release assets. Public publication remains a separately authorized action.

## Completion

Installing either dependency-bearing skill works with no dependency prompt. A GitHub-channel content update
works with an unchanged CLI version. Modified local files survive failed or conflicting updates. The same
operations work through CLI and the typed service layer. Every initial host has real registration/discovery
and invocation evidence; none is silently dropped to finish the release.

The build passes unit, filesystem, packaging, and cross-platform tests. A clean directory outside the authoring
repository can install the tarball and use its declared runtime dependencies and bundled content. Licensing,
source inclusion, and public artifact review are complete before npm publication.

## Approval

Devin selected 1A, 2A, 3A, hard 4A, and 5C and explicitly required Cursor, Antigravity, and Grok Bot now.
The ZIP's original delivery was planning-only. This reconciled plan adds the user's later Grok CLI requirement and
Grok Bot repository observation. Detailed implementation choices are derived defaults, not additional statements
attributed to Devin. Preserve license, publication, and native-host evidence gates when implementing.
