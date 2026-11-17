// What the page may ask of the desktop shell. electron/preload.cjs is the other
// half; the two must list the same functions. In a plain browser (the headless
// audit, a dev server) there is no bridge and the page falls back to localStorage.

export interface CliStatus {
  configured: boolean;
  found: boolean;
  version: string | null;
  detail: string | null;
  node: string | null;
  script: string | null;
}

export interface Bootstrap {
  stored: Record<string, string>;
  about: { appVersion: string; dataDir: string; cli: CliStatus } | null;
}

export interface DesktopBridge {
  bootstrap(): Promise<Bootstrap>;
  setTheme(theme: 'light' | 'dark'): void;
  saveState(key: string, json: string): void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export const bridge: DesktopBridge | null = window.desktop ?? null;

export async function bootstrap(): Promise<Bootstrap> {
  return bridge ? bridge.bootstrap() : { stored: {}, about: null };
}
