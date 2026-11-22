// Private memory of the running app, by the definition that is right for the system, from
// inside the app. This is what --diagnostics reports. The scripts in scripts/memory-tree.*
// measure the same thing from outside and print the same shape; use those when the app cannot
// be asked.
//
// The measurement is @uppercut-labs/electron-private-memory (Windows: private bytes of the
// processes Electron started; macOS: phys_footprint over the process tree; Linux: Anonymous +
// Swap over the process tree). This file gives it the app's budget and ceiling.
import { measureMemory } from '@uppercut-labs/electron-private-memory';
import type { MemoryReport } from '@uppercut-labs/electron-private-memory';
import type { App } from 'electron';
import { SYSTEM } from './platform.ts';
import type { AppConfig } from './platform.ts';

/** Sum over the running app, compared with the budget and ceiling in app.config.json. */
export function measure(app: Pick<App, 'getAppMetrics'>, config: Pick<AppConfig, 'memory'>): Promise<MemoryReport> {
  return measureMemory({ system: SYSTEM, root: process.pid, getAppMetrics: () => app.getAppMetrics(), budgetMB: config.memory.budgetMB, ceilingMB: config.memory.ceilingMB });
}
