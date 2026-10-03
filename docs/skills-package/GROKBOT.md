# Grok Bot account library

## Two distinct destinations

Grok Bot repository work discovers `.agents/skills/<id>/SKILL.md` with sibling resources, according to the
user's direct Bot report. Its chat-wide library is on the Bot execution computer at
`/home/box/agent-data/workflows/<id>/SKILL.md`, with `scripts/`, `references/`, and `assets/` beside the entrypoint.
The Bot later reported that `agent-data` is a symlink to `/home/box/sand-data`, so the library's physical path is
`/home/box/sand-data/workflows`. The `workflows` directory itself is not a symlink and belongs to `box`. These path
details came from direct Bot reports, not a public API. Grok CLI remains a separate host with
`.grok/skills` routes. [H11-H15 in SOURCES.md]

## Install on the Bot computer

The Bot must run the package on its own execution computer as the `box` user. For example:

```sh
npm install -g @uppercut-labs/skills@0.1.0-rc.2 --allow-scripts=@uppercut-labs/skills
uppercut-skills doctor --host grokbot --global
```

On a fresh, qualified Bot runtime, the global npm postinstall preflights every bundled skill. It copies eligible
skills and their support files in one transaction. A pre-existing skill is adopted only when its complete file set
and bytes match the reviewed bundle. A differing folder, or a skill depending on one, is skipped and named in the
postinstall output; the existing folder is not changed. An ordinary local install or an install on another machine
leaves the library untouched. If a managed Bot installation already exists, postinstall preserves it and prints an
explicit update command, retaining saved source channels and local edits.
`update` and `remove` use the same receipts. `--global` does not copy from the user's computer to the Bot computer.
The lifecycle refuses root writes rather than silently installing files with the wrong owner.

The Bot reported npm 11 blocks package postinstall unless the install allows `@uppercut-labs/skills` scripts, as in
the command above, or the user npm config already allows them. If npm still reports that postinstall was blocked,
run `uppercut-skills add <id> --host grokbot --global` explicitly on the Bot computer, or allow the package's
postinstall through that npm installation's normal policy and rerun it. A successful npm package install alone does
not prove the skills were copied; use `uppercut-skills doctor --host grokbot --global` and inspect the Bot skill selector.
Doctor can report a healthy empty managed state, so inspect its `--json` installed IDs and the postinstall skip summary as
well. The Bot's `rc.1` attempt reached the library but stopped at a differing `grill-to-build` folder before writing
any skill; this behavior is the reason for the `rc.2` partial-selection change. [H14 in SOURCES.md]

The explicit CLI route remains available for selected skills, for example
`uppercut-skills add execute-task-cycles --host grokbot --global`.

The adapter accepts account scope only on Linux when the process runs as a non-root user with home `/home/box`, and
the existing `workflows` directory is a normal directory owned by that user. It resolves the library's physical path
inside `/home/box` before writing, so a symlinked `agent-data` parent is supported without following an unchecked
path during file operations. Outside that context it returns `unsupported-account-scope` before writing. This is a
conservative path check, not cryptographic proof of Bot identity. An existing directory is required.

Project scope continues to use `.agents/skills/<id>/` in the selected repository. Do not use `.grok/skills`,
`.claude/skills`, `.cursor/skills`, or Node's global module directory as the Bot account library.

## Acceptance

On a real Grok Bot session, verify `add`, visibility in the Bot's skill selector, invocation by name, access to a
sibling support file, dependency loading, `update`, and managed `remove`. Record the Bot version, execution user,
selected scope, and evidence without putting private account data in this repository. Unit tests prove path gating
and installer behavior; they do not prove that Bot discovers a copied skill in its native library.

The user's `rc.2` Bot screenshots establish a successful global install, healthy managed `starter-pack` and
`computer-setup` in the account library, preservation of the differing `grill-to-build`, and an actual
`starter-pack` invocation from that library. Starter Pack inspected existing progress and did not begin Quick Build.
Doctor's `discovery` field still says `unverified` because the CLI receives no native invocation callback; the
separate Bot report is the invocation evidence. The full lifecycle and the other hosts remain open. [H15 in SOURCES.md]
