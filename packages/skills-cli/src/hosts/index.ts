import { lstatSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
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

const GROKBOT_HOME = "/home/box";
const GROKBOT_LIBRARY = "/home/box/agent-data/workflows";

export interface GrokBotRuntimeEvidence {
  readonly platform: NodeJS.Platform;
  readonly uid: number | undefined;
  readonly selectedHome: string;
  readonly processHome: string;
  readonly actualHome: string;
  readonly actualLibrary: string;
  readonly libraryIsDirectory: boolean;
  readonly libraryIsSymlink: boolean;
  readonly libraryOwnerUid: number;
}

export function qualifiesGrokBotAccountRuntime(evidence: GrokBotRuntimeEvidence): boolean {
  const libraryRelativeToHome = path.posix.relative(GROKBOT_HOME, evidence.actualLibrary);
  return evidence.platform === "linux" && evidence.uid !== undefined && evidence.uid !== 0 &&
    evidence.selectedHome === GROKBOT_HOME && evidence.processHome === GROKBOT_HOME &&
    evidence.actualHome === GROKBOT_HOME && libraryRelativeToHome !== "" &&
    libraryRelativeToHome !== ".." && !libraryRelativeToHome.startsWith("../") &&
    path.posix.basename(evidence.actualLibrary) === "workflows" &&
    evidence.libraryIsDirectory && !evidence.libraryIsSymlink && evidence.libraryOwnerUid === evidence.uid;
}

/** The Bot account library is local to its Linux execution user, not the npm install machine. */
function grokBotAccountLibraryPath(homeDir: string): string | undefined {
  if (process.platform !== "linux" || typeof process.getuid !== "function") return undefined;
  try {
    const library = lstatSync(GROKBOT_LIBRARY);
    const actualLibrary = realpathSync(GROKBOT_LIBRARY);
    return qualifiesGrokBotAccountRuntime({
      platform: process.platform,
      uid: process.getuid(),
      selectedHome: homeDir,
      processHome: homedir(),
      actualHome: realpathSync(GROKBOT_HOME),
      actualLibrary,
      libraryIsDirectory: library.isDirectory(),
      libraryIsSymlink: library.isSymbolicLink(),
      libraryOwnerUid: library.uid,
    }) ? actualLibrary : undefined;
  } catch {
    return undefined;
  }
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
        const accountLibrary = grokBotAccountLibraryPath(options.homeDir);
        if (!accountLibrary) {
          throw new HostAdapterError({
            code: "unsupported-account-scope",
            host: "grokbot",
            scope: "global",
            message:
              "Grok Bot account skills must be installed on the Bot's Linux execution computer as its box user, where /home/box/agent-data/workflows already exists. Run add --host grokbot --global there. No files were written.",
          });
        }
        return { ...target("grokbot", options, "agent-data/workflows"), installDir: accountLibrary };
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

/** Return an unsupported result when this is not the Bot's account-library runtime. */
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
