// The control channel: how a script talks to the running app without starting a second
// instance of it. The channel itself (the named pipe or Unix socket, control.json in the data
// folder, one line of JSON each way, and why a second instance must never be used) is
// @uppercut-labs/electron-control-channel; its README explains it. This file holds what is the
// app's: its command flags, the flags that only mean "do this in the running app". Add the
// app's own here (a launcher adds 'play=' and 'rescan'); measure/shell-check.ts fails when the
// shell acts on a flag that is not in this list.
import * as channel from '@uppercut-labs/electron-control-channel';

export type { Channel, Info, LaunchKind, Reply } from '@uppercut-labs/electron-control-channel';
export const { VERSION, serves, endpoint, readInfo, infoPath, serve, send } = channel;

export const COMMAND_FLAGS: readonly string[] = [...channel.DEFAULT_COMMAND_FLAGS];
export const isCommandFlag = (arg: string): boolean => channel.isCommandFlag(arg, { commandFlags: COMMAND_FLAGS });
export const classify = (argv: readonly string[]): channel.LaunchKind => channel.classify(argv, { commandFlags: COMMAND_FLAGS });
