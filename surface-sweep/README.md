# surface-sweep

Sweep an existing web app and fix observed defects. Requires an accessible app plus permitted browser automation and image inspection for a completed visual review. Without those capabilities, report source-only findings and untested surfaces.

Example: `Use $surface-sweep on the checkout and account flows at desktop and phone widths.`

Outputs: corrected product code, a finite coverage matrix, before/after evidence, and explicit remaining gaps. The optional browser-context probes use the project's existing harness; they do not install a browser. No companion skill is required.

Read [SKILL.md](SKILL.md) for the execution contract.
