import path from "node:path";
import type { InstallTarget } from "../engine/types.js";
import {
  HostAdapterError,
  type HostAdapter,
  type HostId,
  type HostTargetResolution,
  type ResolveHostTargetOptions,
} from "./types.js";

function pathsFor(options: ResolveHostTargetOptions) {
  const rootPath = options.scope === "project" ? options.projectRoot : options.homeDir;
  return { rootPath, join: (...parts: string[]) => path.join(rootPath, ...parts) };
}

function target(
  id: HostId,
  options: ResolveHostTargetOptions,
  relativeInstallDir: string,
): InstallTarget {
  const { rootPath, join } = pathsFor(options);
  return {
    id,
    scope: options.scope,
    rootPath,
    installDir: join(relativeInstallDir),
  };
}

const adapters: Record<HostId, HostAdapter> = {
  codex: {
    id: "codex",
    resolveTarget: (options) => target("codex", options, ".agents/skills"),
  },
  claude: {
    id: "claude",
    resolveTarget: (options) => target("claude", options, ".claude/skills"),
  },
  cursor: {
    id: "cursor",
    resolveTarget: (options) =>
      target(
        "cursor",
        options,
        options.scope === "project" && options.reuseSharedAgents
          ? ".agents/skills"
          : ".cursor/skills",
      ),
  },
  antigravity: {
    id: "antigravity",
    resolveTarget: (options) => {
      if (options.scope === "project") {
        return target("antigravity", options, ".agents/skills");
      }
      if (!options.surface) {
        throw new HostAdapterError({
          code: "surface-required",
          host: "antigravity",
          scope: "global",
          message:
            "Choose Antigravity's IDE or CLI surface before a global install; their documented skill roots differ.",
        });
      }
      const relative =
        options.surface === "ide"
          ? ".gemini/config/skills"
          : ".gemini/antigravity-cli/skills";
      return target("antigravity", options, relative);
    },
  },
  grokbot: {
    id: "grokbot",
    resolveTarget: (options) => {
      if (options.scope === "global") {
        throw new HostAdapterError({
          code: "unsupported-account-scope",
          host: "grokbot",
          scope: "global",
          message:
            "Grok Bot account-library registration is unsupported from this filesystem adapter. The account library requires a native Bot transport; no transport is configured. No files were written.",
        });
      }
      return target("grokbot", options, ".agents/skills");
    },
  },
  grokcli: {
    id: "grokcli",
    resolveTarget: (options) => target("grokcli", options, ".grok/skills"),
  },
};

export const hostAdapters: Readonly<Record<HostId, HostAdapter>> = adapters;

/** Resolve a single selected host and scope; this function never auto-selects or writes. */
export function resolveHostTarget(
  host: HostId,
  options: ResolveHostTargetOptions,
): InstallTarget {
  return hostAdapters[host].resolveTarget(options);
}

/** Return unsupported Grok Bot account scope as data for JSON and programmatic callers. */
export function resolveHostTargetResult(
  host: HostId,
  options: ResolveHostTargetOptions,
): HostTargetResolution {
  try {
    return { status: "ready", target: resolveHostTarget(host, options) };
  } catch (error) {
    if (
      error instanceof HostAdapterError &&
      error.code === "unsupported-account-scope" &&
      error.host === "grokbot" &&
      error.scope === "global"
    ) {
      return {
        status: "unsupported",
        code: error.code,
        host: error.host,
        scope: error.scope,
        message: error.message,
      };
    }
    throw error;
  }
}

/** Grok CLI's documented Claude and shared-agent paths are compatibility routes, not duplicate targets. */
export function getCompatibleDiscoveryPaths(
  host: HostId,
  options: ResolveHostTargetOptions,
): readonly string[] {
  if (host === "grokcli") {
    return [
      path.join(options.scope === "project" ? options.projectRoot : options.homeDir, ".claude", "skills"),
      path.join(options.scope === "project" ? options.projectRoot : options.homeDir, ".agents", "skills"),
    ];
  }
  if (host === "claude" && options.scope === "global") {
    return [path.join(options.homeDir, ".agents", "skills")];
  }
  return [];
}

export { HostAdapterError } from "./types.js";
export type {
  AntigravitySurface,
  HostAdapter,
  HostId,
  HostTargetResolution,
  InstallScope,
  ResolveHostTargetOptions,
} from "./types.js";
