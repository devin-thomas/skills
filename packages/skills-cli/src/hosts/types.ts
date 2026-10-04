import type { InstallTarget } from "../engine/types.js";

export type HostId =
  | "codex"
  | "claude"
  | "cursor"
  | "antigravity"
  | "grokbot"
  | "grokcli";

export type InstallScope = "project" | "global";
export type AntigravitySurface = "ide" | "cli";

export interface ResolveHostTargetOptions {
  scope: InstallScope;
  /** Exact project directory selected by the caller; adapters never discover or initialize Git. */
  projectRoot: string;
  /** Home directory of the machine where installation will execute. */
  homeDir: string;
  /** Required for Antigravity global installs because its documented surfaces use different roots. */
  surface?: AntigravitySurface;
  /** Reuse an already-owned shared .agents/skills destination when the transaction layer confirms it. */
  reuseSharedAgents?: boolean;
}

export interface HostAdapter {
  readonly id: HostId;
  resolveTarget(options: ResolveHostTargetOptions): InstallTarget;
}

export class HostAdapterError extends Error {
  readonly code: "unsupported-account-scope" | "surface-required";
  readonly host: HostId;
  readonly scope: InstallScope;

  constructor(input: {
    code: HostAdapterError["code"];
    host: HostId;
    scope: InstallScope;
    message: string;
  }) {
    super(input.message);
    this.name = "HostAdapterError";
    this.code = input.code;
    this.host = input.host;
    this.scope = input.scope;
  }
}

export type HostTargetResolution =
  | { status: "ready"; target: InstallTarget }
  | {
      status: "unsupported";
      code: "unsupported-account-scope";
      host: "grokbot";
      scope: "global";
      message: string;
    };
