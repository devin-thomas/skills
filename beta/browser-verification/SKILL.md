---
name: browser-verification
description: Reuse a project's browser tooling to investigate web behavior or add a durable Playwright regression test. Use when an agent needs to exercise a web flow, reproduce a browser bug, or choose how to preserve a browser check.
---

# Browser Verification

## Find the existing run path

Read the repository instructions and find the browser command, Playwright config, fixtures, and related specs. In a monorepo, start with the app's own workspace. Check for repo-provided setup or a configured browser tool before installing anything. Use the existing runner if it covers the job, including a runner other than Playwright.

Use a local fixture or a designated preview for interactions that change application state. Check that the server serves the intended checkout. Follow the host's browser and permission rules.

## Explore with the browser tool

Use the project's browser tool or Playwright CLI for interactive checks. If the project already exposes `playwright cli`, use that local command. Otherwise use the installed `playwright-cli` or an available browser tool. Use a task-specific named session, keep the browser headless unless the task calls for a window, and close the session you opened.

Read [Playwright CLI commands](https://github.com/microsoft/playwright-cli) for session and browser selection. If the default branded browser is absent, choose an installed engine that can answer the question. Use the browser tool for individual interactions. Write a scratch script only when the available commands cannot express the required check.

## Preserve the regression

Add a check that should survive this task to the owning project's test suite. Reuse its fixtures and assertions, and keep the spec under its existing runner. For a reported regression, assert the visible behavior that failed and confirm the fix through the same flow. Use Playwright projects to run one spec across the browsers the behavior needs.

For setup, use the lockfile's Playwright version and its browser cache. Check installed browser revisions before installing the specific missing engines. Keep auth state and private diagnostics in ignored output. Let the test runner manage page and server lifetimes.

For a visual review, use [Surface Sweep](https://github.com/devin-thomas/skills/tree/main/surface-sweep). For diagnostics, reuse the project's existing helpers. If it uses [browser-qa-harness](https://github.com/uppercut-labs/js-kit/tree/main/packages/browser-qa-harness), its audit functions accept an existing Playwright page.

Report the command or flow exercised, the browsers or viewports that ran, and the observed result. Distinguish fixture behavior, live behavior, and physical-device coverage.
