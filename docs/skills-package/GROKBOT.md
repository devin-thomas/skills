# Grok Bot: first-release native integration

## Identity and evidence

The target is **Grok Bot**, the Bot product with repository work and a separate native skills/plugin library.
It is not Grok Build/CLI, a model choice in Cursor, or OpenClaw. Official docs describe saving skills,
using the `/` skill selector, and native plugin/skill management. They do not establish a universal writable
filesystem discovery root for the account library. [H6, H7 in SOURCES.md]

The user's Bot directly reported that repository work discovers `.agents/skills/<skill>/SKILL.md`, with complete
support files. Treat that as an observed project route to verify in a real Bot repo session, not as proof that the
same files appear in the separate chat-wide private skill library. [H11]

Do not implement `grokbot = mkdir ~/.grok/skills`. Do not claim a Cursor IDE plugin manifest is automatically
accepted by Grok Bot: Cursor's plugin reference alone is not evidence of that equivalence. [H8]

## Initial usable path

The intended user action remains `add <id> --host grokbot`. Project scope writes the Bot's repository skill route
on its execution computer; global/account scope uses native library registration on that account surface.
Do not infer that a copy on the user's laptop reaches the Bot's remote computer.
The package resolves the selected source snapshot and full dependency closure exactly as for every other host.
It stages the complete bundle in an installer-owned request directory, then registers each required skill through
the Bot's **actually available native skill-management mechanism**. The adapter must preserve all support files;
recreating only the visible SKILL.md text is insufficient.

The native operation may be provided by a host agent bridge, not by a public shell CLI. The application-level
`HostRegistrationPort` is the stable boundary. The implementation ticket must discover the supported tool/SDK or
import route in a real Grok Bot session and implement that route. Do not invent a vendor method name, hidden API,
cookie-based endpoint, undocumented app database edit, or shell command.

For account-library scope, when the package is launched outside a qualifying Grok Bot session, it may stage a request and report
`registration-required` with a single handoff to the Bot. That is partial preparation, not success and not the
accepted end-state of the Grok Bot adapter. In-host completion must be verified before the first release claims support.
Do not invent a desktop-to-VM transport or automatically publish the bundle to a cloud account.

## Native registration request, proposed internal contract

Inputs: transaction ID, exact requested roots and dependency closure, approved source identities/revisions,
complete local resource roots, target Bot/library context from the active host, and content digests.
Outputs: per-skill native identity, stored content/resource evidence, enabled/discovered status, actual library
scope, native operation provenance, and partial-failure information. These are our types, not a claim about vendor API fields.

A native tool's successful return is useful evidence; verify saved content and discoverability too.
Keep account/Bot IDs and absolute paths in local state, not in the public package or shared fixtures.
Registration does not authorize running the skills, enabling routines, publishing Bot templates, or adding connectors.

## Dependency handling

Register the entire required closure automatically. One existing platform permission gate may govern the selected
operation; the installer does not add a question about each inner skill. A user selecting `execute-task-cycles`
never has to discover, locate, or manually approve `execute-task` as a separate package.
Do not use `--no-dependencies` to work around missing support-file or native-import capability.

## Updates, deletion, and failure

Before replacement, compare managed content with the previous receipt; preserve user edits. Use the same native IDs
for managed updates where supported. Keep a recovery record when native registration is not atomic. If one registration
fails, report exactly which operations completed and which were rolled back. Never erase unrelated private skills,
memories, Bot profiles, routines, or plugins. Removal affects only owned skills no longer required by retained roots.

## Release gate

Early ticket SKP-003 must record both the project discovery route and account-library resources contract. SKP-011
must prove add, discovery, invocation, dependency loading, update, and managed removal in both selected Grok Bot
scopes. A saved helper instruction that still
requires manual reconstruction of dependencies is not parity. Failure to establish this route is an explicit v1
release blocker, not permission to postpone Grok Bot to v2.
