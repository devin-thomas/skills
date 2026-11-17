import { Tooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** A tooltip. `keys` shows the control's shortcut after the label. */
export function Tip({ label, keys, children }: { label: ReactNode; keys?: string[]; children: ReactElement<Record<string, unknown>> }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6} className="z-(--z-tooltip)">
          <Tooltip.Popup className="tooltip">
            {label}
            {keys && (
              <span className="ml-2 inline-flex gap-1" aria-hidden="true">
                {keys.map((key) => (
                  <kbd key={key} className="tooltip-key">
                    {key}
                  </kbd>
                ))}
              </span>
            )}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export function formatTime(at: number) {
  return timeFormat.format(at);
}
