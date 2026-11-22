# Tooling notes (conditional)

Read only when an install or typecheck fails. Host details below were observed on a Linux test host on 2026-11-16 and may not apply elsewhere.

## npm `allow-scripts` conflict (host-specific)

Symptom: `npx shadcn@latest init` ends with `npm error code EALLOWSCRIPTS ... --allow-scripts is not allowed in project-scoped installs`. Cause: the box's user-level `~/.npmrc` sets `allow-scripts=...`, and the shadcn CLI's own `npm install` call then fails. Workaround that worked: run the shadcn commands with an empty user config, `NPM_CONFIG_USERCONFIG=/path/to/empty-file`. Do not copy or print the real `~/.npmrc` (it can hold auth). On a machine without that setting this step is unnecessary.

## Observations to treat as version-specific

- shadcn CLI 4.23.0 `init` added a package named `cn` to dependencies alongside `class-variance-authority`, `radix-ui`, `lucide-react`, `tw-animate-css`. The shadcn CLI docs mention a `cn` migration, so this may be intentional. `shadcn add` then wrote `import { cn } from "cn"` in generated files instead of the project's `@/lib/utils`. The project's `src/lib/utils.ts` re-exported `cn` from that package. Treat the direct npm import as a substitution to flag and rewrite; see Known gotchas in SKILL.md.
- TypeScript 7.0.2 (what the Vite react-ts template installed) rejects `baseUrl`. Use `compilerOptions.paths` only.
- `shadcn add` re-run on an existing `components.json` prompts before overwrite; pass `-y` only after reading what it will overwrite.
- Runtime issues that a passing build does not catch (CommandDialog wrapper, `dark` on `<html>`, drawer width) are in Known gotchas in SKILL.md, not only install failures.

## Source of truth

Each library's own docs: ui.shadcn.com/docs/cli, base-ui.com, sonner.emilkowal.ski, number-flow.barvian.me, magicui.design/docs/installation, ui.aceternity.com/docs/cli.
