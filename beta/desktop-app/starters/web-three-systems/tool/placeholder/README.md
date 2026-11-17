# Placeholder tool

`example-tool.c` stands in for the app's bundled command-line tool until the real one exists. It lets the packager, the installers and the installed checks run on every system with a real executable in place. The app reads its answer as a damaged installation, so nothing half works.

Build it on each system, then stage it for the packager:

| System | Build | Stage |
| --- | --- | --- |
| macOS (one universal file) | `cc -O2 -arch arm64 -arch x86_64 -o example-tool example-tool.c` | `node scripts/stage.mjs placeholder darwin-arm64 tool/placeholder/example-tool` |
| Linux (static, any distribution) | in `alpine:3` for each architecture: `apk add build-base && cc -O2 -static -s -o example-tool example-tool.c` | `node scripts/stage.mjs placeholder linux-arm64 tool/placeholder/example-tool` (and `linux-x64`) |
| Windows | in a Visual Studio developer shell: `cl /O2 /MT /Brepro example-tool.c /Fe:example-tool.exe` | `node scripts/stage.mjs placeholder win32-x64 tool\placeholder\example-tool.exe` |

Why these flags, from build 2: one binary per system and processor; static musl on Linux so it runs on any distribution; MSVC with `/MT` on Windows so the exe needs no runtime DLL, and `/Brepro` so the same source and compiler give the same bytes. Nothing here was built in this repository: the starter's tests use the stand-in in `test/standin-tool.cjs` instead.

Replace it with the real tool: `node scripts/stage.mjs tool <target> <file>`.
