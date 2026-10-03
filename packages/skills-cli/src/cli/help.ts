export const HELP_TEXT = `Uppercut Skills

Usage:
  uppercut-skills list [options]
  uppercut-skills show <skill-id...> [options]
  uppercut-skills add <skill-id...> [options]
  uppercut-skills update [skill-id...]
  uppercut-skills remove <skill-id...> [options]
  uppercut-skills doctor [options]
  uppercut-skills serve-mcp [--port <0-65535>] [--json]

Options:
  --host <id>            Select codex, claude, cursor, antigravity, grokbot, or grokcli
  --surface <ide|cli>    Select Antigravity's global IDE or CLI installation surface
  --project <directory>  Install in this project directory
  --global               Install for the current user
  --latest               Use and remember the GitHub content channel
  --channel <name>       Use bundled or github content
  --no-dependencies, -nd Add roots without missing skill dependencies
  --dry-run              Report planned changes without applying them
  --json                 Emit one versioned JSON result
  --verbose              Include detailed operation output
  --help                 Show this help

MCP catalog server:
  serve-mcp binds to 127.0.0.1 and exposes only catalog.list and catalog.show at /mcp.
`;
