# Beta skills

Skills that work but are not released on `main` yet. They are not in the manifest or the npm package, and they may change or move without notice.

| Skill | What it does |
| --- | --- |
| [desktop-app](desktop-app/SKILL.md) | Builds or improves a desktop app: SwiftUI on macOS, a Rust utility on Windows, or a content app in an Electron shell over a bundled command-line tool on Windows, macOS and Linux. Includes the premium bar and the starters. |
| [watch-this-video](watch-this-video/SKILL.md) | Analyzes a video with local Whisper, terminology correction and direct visual review, and writes a timestamped evidence report. |
| [watch-this](watch-this/SKILL.md) | Turns a video into a reusable skill, using `watch-this-video` for the evidence. Requires `watch-this-video`. |
| [ui-library-selection](ui-library-selection/SKILL.md) | Replaces hand-built UI parts in a React and Tailwind app with established libraries, then checks the build and clicks through the result in a browser. |

To install one, point your agent at this folder on the `beta` branch:

```text
Install desktop-app from https://github.com/devin-thomas/skills/tree/beta/beta/desktop-app for this host.
```

Install `watch-this` together with `watch-this-video`.
