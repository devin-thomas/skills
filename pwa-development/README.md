# pwa-development

Build, repair, or audit installation, offline behavior, updates, and storage for a web app. Preserve the product's chosen framework and platform scope.

Example: `Use $pwa-development to audit offline edits and recovery after an app update.`

Optional dependency-free helpers require Node.js 22+. From this skill directory, run `node scripts/audit-manifest.mjs --help` or `node scripts/probe-release.mjs --help`. Use an absolute manifest path for another project. Exit codes: 0 means the helper passed, 1 means findings failed its checks, and 2 means invalid CLI usage.

Outputs: implementation or audit findings, a platform evidence matrix, and explicit untested device/runtime behavior. Helpers cannot prove installation, offline correctness, or physical-device behavior.

Read [SKILL.md](SKILL.md) for the execution contract.
