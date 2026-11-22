// Names every packaging script derives from app.config.json, in one place.
export const TARGETS = ['win32-x64', 'darwin-arm64', 'linux-arm64', 'linux-x64'];

/** The parts of app.config.json the names come from. */
export interface NameConfig {
  productName: string;
  appId: string;
  linux?: { name?: string };
}

export function names(config: NameConfig): { linuxName: string; fileBase: string; desktopFile: string } {
  // Linux package, folder and command name: lower case, hyphens ("Example App" -> "example-app").
  const linuxName =
    config.linux?.name ??
    config.productName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return {
    linuxName,
    // File names of archives: <fileBase>-<version>-<platform>-<arch>.<ext>
    fileBase: linuxName,
    // The installed desktop entry, and the app's desktop name at run time.
    desktopFile: `${config.appId}.desktop`,
  };
}
