# Journeys, budgets and the use gate

Fill this in before choosing components. The audit and the measurement scripts read the numbers from `qa/journeys.json` and `app.config.json`; this page says what they mean and holds what a script cannot.

## Essential journeys

Five to fifteen things a person comes to this app to do, each as one sentence and a step budget. A step is one run of typing or one key combination. Add each to `qa/journeys.json` and give it a script in `qa/audit.mjs`.

| Id | Journey | Step budget | Why this many |
| --- | --- | --- | --- |
| note-with-item | Write a titled note and add one item from the list | 7 | Starter example. Replace it. |

## Latency budgets

Each named interaction has a budget. `qa/typing.mjs` checks the first two in the real shell.

| Interaction | Budget | How it is measured |
| --- | --- | --- |
| Key press to the frame that shows it, main text field | 95th percentile 50 ms, never over 100 ms | `pnpm qa:typing` |
| Ctrl+K to the palette | 50 ms target, 100 ms limit | `pnpm qa:typing` |
| List scroll, 10,000 rows | at most 1 late frame per 1,000; 99th percentile within 5% of the refresh interval | `python measure/run.py` |

## Memory budget

Private memory over the process tree: budget 300 MB after five minutes idle, ceiling 680 MB at any time. Split the budget into the empty shell's share (measure the starter before adding anything) and the app's own share. The app's share may not grow without an entry in `DECISIONS.md`.

| Build | Shell share | App share | Total idle | Peak |
| --- | --- | --- | --- | --- |
| | | | | |

## Independent critic

After each round of screenshots (`pnpm qa:shots`), a reviewer that did not build the app and sees only the screenshots writes what reads as generic, unclear or unfinished. The builder's notes, the code and the audit stay out of its brief. Record the round, the findings and what changed.

## Use gate and papercut log

The app is not called premium until the owner has done real work in it. Until then every report says "passes the automated bar; the owner has not used it". Each annoyance found in use goes here with a screenshot path, and each iteration closes at least one.

| Date | Papercut | Screenshot | Closed in |
| --- | --- | --- | --- |
| | | | |

## Not verified

List what this build did not check, in plain words, and keep it current: screen reader, IME, key-to-photon with a camera, resize, cold start after a reboot, and each failure of the backend that was only simulated.
