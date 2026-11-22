// What the page may ask Chromium for, and what any web contents may become. The page is the
// app's own code, served from app://local with no network access, but a bug or an injected
// string must still not reach the camera, the microphone, notifications from the web, the
// user's location, HID or serial devices, or another origin.
//
// Rules (premium bar, "Secure desktop boundary"):
//   - Every permission is denied except those in ALLOWED, and those only for the app's origin.
//     The starter allows one: writing text to the clipboard ("Copy details", src/state/job.ts).
//     An app that needs another adds it here with its reason, and the test lists it.
//   - Every web contents, not just the main window, refuses to navigate away from the app's
//     origin, to open a window, or to attach a <webview>.
// measure/shell-check.ts fails when this module is not installed before the first window.
import type { App, Session, WebContents } from 'electron';

/** permission name -> why the app needs it. */
export const ALLOWED: Record<string, string> = {
  'clipboard-sanitized-write': '"Copy details" copies a failure\'s developer text for whoever repairs the app',
};

/** True when `permission`, asked by a page at `requestingUrl`, is granted. Pure, for the tests. */
export function permissionDecision(permission: string, requestingUrl: unknown, origin: string): boolean {
  if (!Object.hasOwn(ALLOWED, permission)) return false;
  return typeof requestingUrl === 'string' && (requestingUrl === origin || requestingUrl.startsWith(`${origin}/`));
}

/** Where a request comes from: the frame's URL when Electron gives one, else the contents'. */
function requestingUrl(webContents: WebContents | null, details: { requestingUrl?: string; securityOrigin?: string } | undefined): string {
  return details?.requestingUrl || details?.securityOrigin || webContents?.getURL?.() || '';
}

export interface Boundary {
  describe(): { allowed: string[]; decisions: { kind: 'request' | 'check'; permission: string; granted: boolean }[] };
}

/**
 * Install the boundary. Call inside app.whenReady(), before the first window.
 *   app, session   from Electron
 *   origin         the page's origin ("app://local")
 *   openExternal   (url) => void, for http(s) links the page asks to open
 */
export function install({ app, session, origin, openExternal }: { app: Pick<App, 'on'>; session: { defaultSession: Session }; origin: string; openExternal: (url: string) => void }): Boundary {
  const ses = session.defaultSession;
  const seen: ReturnType<Boundary['describe']>['decisions'] = [];
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const granted = permissionDecision(permission, requestingUrl(webContents, details), origin);
    seen.push({ kind: 'request', permission, granted });
    callback(granted);
  });
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const url = details?.requestingUrl || requestingOrigin || webContents?.getURL?.() || '';
    const granted = permissionDecision(permission, url, origin);
    if (seen.length < 200) seen.push({ kind: 'check', permission, granted });
    return granted;
  });
  ses.setDevicePermissionHandler(() => false);

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (!url.startsWith(`${origin}/`)) event.preventDefault();
    });
    contents.on('will-redirect', (event, url) => {
      if (!url.startsWith(`${origin}/`)) event.preventDefault();
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) openExternal(url);
      return { action: 'deny' };
    });
  });
  return { describe: () => ({ allowed: Object.keys(ALLOWED), decisions: seen.slice(-50) }) };
}
