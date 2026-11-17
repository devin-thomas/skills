// The shell the page talks to. Inside the desktop app that is the preload's
// bridge. In a plain browser (the headless audit, a dev server) it is the
// stand-in, fetched as its own chunk so the desktop app never loads it.
import config from '../app.config.json';
import type { Bootstrap, DesktopBridge, Platform } from './bridge';

export const desktop: DesktopBridge = window.desktop ?? (await import('./bridge.fake')).createFakeBridge(config.storagePrefix);

export const boot: Bootstrap = await desktop.bootstrap();
// The shell always says which system it is on; the page never guesses.
export const platform: Platform = boot.platform;
