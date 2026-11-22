import { Dialog } from '@base-ui/react/dialog';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { keysOf, type Shortcut } from '../state/shortcuts';
import { Kbd } from './ui';

export interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  /** Runs the command from anywhere, and is shown beside it. */
  shortcut?: Shortcut;
  keywords?: string;
  /** Hidden until the query asks for it. */
  hidden?: boolean;
  disabled?: boolean;
  /** Element id to focus once the palette has closed. */
  focus?: string;
  run: () => void;
}

function matches(command: Command, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return !command.hidden;
  const text = `${command.group} ${command.label} ${command.hint ?? ''} ${command.keywords ?? ''}`.toLowerCase();
  return q.split(/\s+/).every((token) => text.includes(token));
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<string | null>(null);

  // Where focus was before the palette opened. The app usually opens it from a shortcut by
  // setting `open`, not through a Base UI trigger, so Base UI has no trigger to return focus to
  // and focus fell to the page body on close. The last element focused outside the palette is
  // kept here and focus returns to it.
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const note = (event: FocusEvent) => {
      const el = event.target;
      if (el instanceof HTMLElement && !el.closest('.palette')) opener.current = el;
    };
    document.addEventListener('focusin', note);
    return () => document.removeEventListener('focusin', note);
  }, []);

  // Every opening starts empty, however it was opened (a shortcut sets `open` directly and
  // never passes through onOpenChange below), so typed keys never append to the last query.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setQuery('');
      setActive(0);
      focusAfter.current = null;
    }
    wasOpen.current = open;
  }, [open]);

  const visible = commands.filter((c) => matches(c, query));
  const current = Math.min(active, Math.max(0, visible.length - 1));
  const groups: Array<{ name: string; items: Array<{ command: Command; index: number }> }> = [];
  visible.forEach((command, index) => {
    let group = groups.find((g) => g.name === command.group);
    if (!group) groups.push((group = { name: command.group, items: [] }));
    group.items.push({ command, index });
  });

  function close(focusId: string | null) {
    focusAfter.current = focusId;
    onOpenChange(false);
  }

  function run(command: Command | undefined) {
    if (!command || command.disabled) return;
    close(command.focus ?? null);
    command.run();
  }

  function move(to: number) {
    if (visible.length === 0) return;
    const next = (to + visible.length) % visible.length;
    setActive(next);
    // Keyboard navigation jumps to the row without smooth scrolling.
    requestAnimationFrame(() => {
      list.current?.querySelector(`#command-${next}`)?.scrollIntoView({ block: 'nearest' });
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setQuery('');
          setActive(0);
          focusAfter.current = null;
        }
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="scrim" />
        <Dialog.Popup
          className="palette"
          initialFocus={input}
          finalFocus={() => {
            const id = focusAfter.current;
            if (id) return document.getElementById(id);
            const back = opener.current;
            return back && back.isConnected ? back : true;
          }}
        >
          <Dialog.Title className="sr-only">Commands</Dialog.Title>
          <div className="hair-b focus-mark relative flex h-11 flex-none items-center gap-2.5 pr-3 pl-3.5">
            <Search size={16} strokeWidth={1.75} className="flex-none text-fg-3" aria-hidden="true" />
            <input
              ref={(el) => {
                // Focus in the same commit that shows the palette, so keys typed
                // straight after Ctrl+K land in the field.
                input.current = el;
                if (el && document.activeElement !== el) el.focus({ preventScroll: true });
              }}
              className="bare h-full text-body"
              value={query}
              placeholder="Type a command"
              role="combobox"
              aria-label="Command"
              aria-expanded={visible.length > 0}
              aria-controls="command-list"
              aria-autocomplete="list"
              aria-activedescendant={visible.length ? `command-${current}` : undefined}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') move(current + 1);
                else if (event.key === 'ArrowUp') move(current - 1);
                else if (event.key === 'Home' && !query) move(0);
                else if (event.key === 'End' && !query) move(visible.length - 1);
                else if (event.key === 'Enter') run(visible[current]);
                else return;
                event.preventDefault();
              }}
            />
            <Kbd>Esc</Kbd>
          </div>
          {visible.length > 0 ? (
            <div ref={list} id="command-list" role="listbox" aria-label="Commands" className="scroll-cue min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
              {groups.map((group) => (
                <div key={group.name} role="group" aria-label={group.name}>
                  <div className="px-2 pt-2 pb-1 text-small text-fg-3" aria-hidden="true">
                    {group.name}
                  </div>
                  {group.items.map(({ command, index }) => (
                    <div
                      key={command.id}
                      id={`command-${index}`}
                      role="option"
                      aria-selected={index === current}
                      aria-disabled={command.disabled || undefined}
                      data-active={index === current}
                      className="option rounded-md aria-disabled:text-fg-4"
                      onPointerMove={() => {
                        if (index !== current) setActive(index);
                      }}
                      onClick={() => run(command)}
                    >
                      <span className="truncate">{command.label}</span>
                      {command.hint && <span className="truncate text-small text-fg-3">{command.hint}</span>}
                      {command.shortcut && (
                        <span className="ml-auto flex flex-none gap-0.5" aria-hidden="true" data-keys="">
                          {keysOf(command.shortcut).map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-fg-2">No command matches “{query.trim()}”.</p>
              <p className="mt-1 text-small text-fg-3">Try “theme”, “clear” or “about”.</p>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
