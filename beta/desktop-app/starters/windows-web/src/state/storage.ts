// Saved documents. In the desktop app each one is written to a file by the main
// process, which survives the app being killed. In a browser it falls back to
// localStorage. Every access is guarded: storage can be missing, full or corrupt.

let persist: ((key: string, json: string) => void) | null = null;
let preloaded: Record<string, string> | null = null;

export function configureStorage(saveState: ((key: string, json: string) => void) | undefined, stored: Record<string, string> | undefined) {
  persist = saveState ?? null;
  preloaded = saveState ? { ...stored } : null;
}

export function read<T>(key: string): T | null {
  try {
    const raw = preloaded ? (preloaded[key] ?? null) : localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function write(key: string, value: unknown): boolean {
  try {
    const json = JSON.stringify(value);
    if (persist && preloaded) {
      persist(key, json);
      preloaded[key] = json;
    } else localStorage.setItem(key, json);
    return true;
  } catch {
    return false;
  }
}
