// Electron's fuses for this app: switches compiled into the Electron binary that turn off what a
// packaged content app never uses and an attacker with a foothold on the machine would. They are
// flipped once, in scripts/package.ts, before macOS signing (flipping changes the binary, so it
// must come before the signature), and read back from the packaged app by
// scripts/fuses-check.ts. measure/shell-check.ts fails if the Node.js doors below are opened.
//
//   RunAsNode                                   ELECTRON_RUN_AS_NODE=1 <app> makes the app's own
//                                               signed binary a plain Node.js. Left ON in the
//                                               starter, with RUN_AS_NODE_REASON below; turning
//                                               it off is the next step, and only after the
//                                               installed checks stop depending on it
//   EnableNodeOptionsEnvironmentVariable false  NODE_OPTIONS=--require=<file> would run that file
//                                               inside the app at startup
//   EnableNodeCliInspectArguments false         --inspect would open a debugger port into the
//                                               main process
//   OnlyLoadAppFromAsar true                    the app's code is read only from app.asar, never
//                                               from a loose app/ folder dropped beside it
//   EnableEmbeddedAsarIntegrityValidation       app.asar must match the hash recorded at
//                                               packaging; on macOS only, where the packager
//                                               records it in Info.plist and a build has proved
//                                               it (see INTEGRITY_SYSTEMS)
//   GrantFileProtocolExtraPrivileges false      file:// pages lose Chrome's extra privileges; the
//                                               page is served from app://, never file://
//
// Left at Electron's default, with the reason:
//   EnableCookieEncryption                      on macOS it asks the Keychain for a key at first
//                                               use, which can raise a Keychain dialog (it takes
//                                               focus); the page sets no cookies
//   LoadBrowserProcessSpecificV8Snapshot        the app ships no custom V8 snapshot
import { FuseV1Options, FuseVersion } from '@electron/fuses';

/**
 * Why RunAsNode is still on. measure/shell-check.ts requires this to be a real reason whenever
 * the fuse is on, and scripts/fuses-check.ts reports it. An app that turns the fuse off deletes
 * this, sets the fuse to false, and moves its installed checks to system Node.
 */
export const RUN_AS_NODE_REASON =
  'The installed checks run the installed app\'s own executable as Node: scripts/installed-helpers.cjs (built from installed-helpers.ts) starts each bundled helper from the signed program that starts it in use (installed-check.ps1 and .sh, step "helpers"), and on macOS and Linux scripts/control.cjs (built from control.ts) reaches the running app the same way. Not yet re-proven with system Node on Windows and Linux.';

/** Systems where embedded asar integrity is turned on. Add one only after its packaged app has started with it. */
export const INTEGRITY_SYSTEMS: string[] = ['darwin'];

/** The fuse wire for one packaging target's platform ('darwin', 'win32', 'linux'). */
export function fusesFor(platform: string) {
  return {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: true, // RUN_AS_NODE_REASON
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: INTEGRITY_SYSTEMS.includes(platform),
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  };
}

/** Names of the fuses set above, for reports. */
export const FUSE_NAMES: (keyof typeof FuseV1Options)[] = ['RunAsNode', 'EnableNodeOptionsEnvironmentVariable', 'EnableNodeCliInspectArguments', 'OnlyLoadAppFromAsar', 'EnableEmbeddedAsarIntegrityValidation', 'GrantFileProtocolExtraPrivileges'];
