---
name: quick-build
description: Use when a user wants a small meaningful app scoped and built through one compact design interview, or explicitly invokes Starter Pack Quick Build. Do not use for a throwaway experiment, a minor fix, or a complex project that needs extended discovery.
---

# Quick Build

Take one meaningful idea through a short interview, an approved plan, a durable build, and the requested delivery. Keep the learner's first useful action central.

## 1. Choose the entry mode

Standalone is the default. Inspect repository instructions, existing plans, assets, available tools, and any supplied handoff. Reuse answered questions and completed work. Require only capabilities needed for this project; no Starter Pack accounts, phone setup, private progress repository, or companion skill is a standalone prerequisite.

When the user explicitly requests Starter Pack Phase 2 or resumes a Starter Pack Quick Build step, read [Starter Pack mode](references/starter-pack-mode.md) and follow that curriculum contract instead of the standalone stages below. Its resource version is 0.2.0 and requirements revision is 2026-09-10; the source snapshot is identified in [README.md](README.md). Use matching supplied requirements or the canonical linked resources. If requirements have changed, resolve the matching official skill/version before certifying completion. If required resources are unavailable, preserve progress and request the matching instruction packet; do not guess graduation rules or silently switch modes to bypass prerequisites.

Done when the mode, existing work, intended outcome, and available capabilities are understood.

## 2. Interview once

Ask one compact round about missing decisions: idea, audience, primary behavior, inputs/content, exclusions, visual direction, target devices, and definition of done. Do not ask every topic as a separate question or repeat facts already supplied. Accept conversational answers and omissions; choose reversible implementation details directly. Follow up only on consequential unresolved choices. If the project needs substantial discovery, explain why and suggest `grill-to-build`; do not force it into a quick-build promise.

Clarify the first useful action and starting empty state. Prioritize the user's input and controls in creator tools. Do not invent uploads, unrelated demo content, or autoplay. Treat demos as an explicit choice.

Done when the smallest complete scope and meaningful normal, empty, and error behavior can be stated without inventing product decisions.

## 3. Write a compact plan

Use the bundled [PLAN](templates/PLAN.md), [SPEC](templates/SPEC.md), [DECISIONS](templates/DECISIONS.md), and [TICKET](templates/TICKET.md) templates. Reuse equivalent existing artifacts and filename conventions; do not create competing decision records or specifications. Keep documents proportional to the build and confidential material private.

For a blank project, suggested defaults are React and TypeScript, Vite for a simple browser app, and Cloudflare if deployment is requested. Use a full-stack framework, relational database such as Neon, authentication, or payments only when the product needs them. Preserve existing stacks and respect alternatives selected by the user. A hosting default does not authorize creating accounts, paid services, new credential scopes, or public publication.

Write observable acceptance checks and separate build/type checks, layout/accessibility, release availability, primary behavior, and device-specific promises. Preserve zoom and keep primary controls readable and reachable. Screenshots or desktop emulation do not establish physical-device behavior; clearly labeled learner reports can supply that evidence.

Summarize the result: "I wrote the plan and broke the build into steps. You can tell me to go, or ask to inspect the plan or tickets first." Obtain approval of the concrete scope before implementation. Reuse an earlier approval when it covers this actual plan; resolve material changes before building.

Done when the plan and ordered work have observable acceptance conditions and the user has approved the scope.

## 4. Build and verify

Implement the approved scope in a durable project directory, preserving unrelated work and existing package-manager conventions. Keep dependencies project-local. Use supported authentication and secret storage; never request secrets in chat or weaken Git email protections to unblock a push. Resolve consequential tool failures narrowly and record the actual repair and validation.

Run repository-standard checks and exercise the primary flow, including meaningful empty/error states, at the intended viewport sizes. Report unperformed device checks explicitly. Do not mark a ticket complete from a build alone when behavioral acceptance remains unverified.

Done when all scoped behavior is implemented and the required verification has passed, or remaining checks are explicitly pending with their impact.

## 5. Deliver and leave a resume point

Carry out already-authorized Git publishing or deployment to the selected destination. If delivery is local-only, provide the working run command and source location. Otherwise confirm the intended owner, source visibility, hosting destination, and existing authorization before the external action; prepare the reviewable result first when a decision is missing.

Verify any published revision and live primary action. A local commit, HTTP 200, screenshot, or URL alone does not prove remote delivery or behavior. Preserve local achievements if publishing fails and identify the exact pending action.

Record source location, actual live URL when applicable, verification evidence, unresolved checks, and one next action in the existing handoff or plan. Keep secrets and private content out of public files. Resume from that record without repeating intake or claiming chat history automatically transfers. Standalone completion is project completion, never Starter Pack graduation.

Done when the approved delivery is verified or explicitly blocked, artifacts match reality, and the user has a usable result or a precise resume point.
