import { Dialog } from '@base-ui/react/dialog';
import { Tooltip } from '@base-ui/react/tooltip';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import config from '../app.config.json';
import { bridge, type Bootstrap } from './bridge';
import { CommandPalette, type Command } from './components/CommandPalette';
import { ItemList, type Item } from './components/ItemList';
import { TitleBar } from './components/TitleBar';
import { Toaster } from './components/Toaster';
import { Tip, formatTime } from './components/ui';
import { useDraft } from './state/draft';
import { SHORTCUTS, keysOf, matches } from './state/shortcuts';
import { toast } from './state/toast';

// The starter screen: a note with a title and a body, beside a 10,000-row list
// whose rows can be added to the note. It exists so the shell, the tokens, the
// audit and the measurements have something real to run against on day one.
// Replace it with the app's own screens and keep the parts around it: the
// command registry, the one shortcut table, the saved draft and the title bar.

type Theme = 'light' | 'dark';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  // Keep the window's caption buttons and background in step with the page.
  useEffect(() => {
    bridge?.setTheme(theme);
  }, [theme]);
  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('app.theme', next);
    } catch {
      // The choice still applies for this session.
    }
    setTheme(next);
  }
  return [theme, toggle];
}

const narrowQuery = window.matchMedia('(max-width: 859.98px)');

function useNarrow() {
  return useSyncExternalStore(
    (listener) => {
      narrowQuery.addEventListener('change', listener);
      return () => narrowQuery.removeEventListener('change', listener);
    },
    () => narrowQuery.matches,
    () => false,
  );
}

export const FIELD = { title: 'field-title', body: 'field-body', filter: 'rail-filter' } as const;
// Focus moves in the same turn as the key that asked for it, so keys typed
// straight after a shortcut land in the new field. Only an element that is not
// focusable yet (a panel still hidden in this render) waits one frame.
function focusField(id: string) {
  const el = document.getElementById(id);
  el?.focus();
  if (document.activeElement !== el) requestAnimationFrame(() => document.getElementById(id)?.focus());
}

const WORDS = ['Amber', 'Birch', 'Cedar', 'Delta', 'Ember', 'Flint', 'Grove', 'Harbor', 'Indigo', 'Juniper', 'Kestrel', 'Lumen', 'Meadow', 'Nimbus', 'Orchard', 'Pebble'];

function makeItems(count: number): Item[] {
  const out: Item[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ id: `item-${i}`, label: `${WORDS[i % WORDS.length]} ${WORDS[(i * 7 + 3) % WORDS.length]} ${i + 1}`, detail: `${((i * 37) % 900) + 100} KB` });
  }
  return out;
}

export function App({ boot }: { boot: Bootstrap }) {
  const note = useDraft();
  const { draft } = note;
  const [theme, toggleTheme] = useTheme();
  const narrow = useNarrow();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [items] = useState(() => makeItems(10_000));

  const query = filter.trim().toLowerCase();
  const rows = query ? items.filter((item) => item.label.toLowerCase().includes(query)) : items;
  const railShown = narrow ? railOpen : true;

  function clearNote() {
    const before = draft;
    note.clear();
    toast({ title: 'Note cleared', action: { label: 'Undo', run: () => note.replace(before) } });
  }

  function addItem(item: Item) {
    note.edit({ body: draft.body ? `${draft.body.replace(/\n?$/, '\n')}${item.label}\n` : `${item.label}\n` });
  }

  function showItems() {
    if (narrow && railOpen) {
      setRailOpen(false);
      return;
    }
    setRailOpen(true);
    focusField(FIELD.filter);
  }

  // The command list is the single registry: the palette shows it and the key
  // handler below runs it. A command a person repeats carries a shortcut.
  const commands: Command[] = [
    { id: 'go-title', group: 'Go to', label: 'Title', keywords: 'focus', shortcut: SHORTCUTS.focusTitle, focus: FIELD.title, run: () => {} },
    { id: 'go-body', group: 'Go to', label: 'Note', keywords: 'body text focus', shortcut: SHORTCUTS.focusBody, focus: FIELD.body, run: () => {} },
    { id: 'items', group: 'Go to', label: `All ${items.length.toLocaleString('en-US')} items`, keywords: 'list filter browse', shortcut: SHORTCUTS.items, run: showItems },
    { id: 'clear', group: 'Note', label: 'Clear note', keywords: 'discard delete', shortcut: SHORTCUTS.clear, disabled: note.blank, focus: FIELD.title, run: clearNote },
    { id: 'theme', group: 'View', label: theme === 'dark' ? 'Use the light theme' : 'Use the dark theme', keywords: 'appearance dark light', shortcut: SHORTCUTS.theme, run: toggleTheme },
    { id: 'about', group: 'View', label: `About ${config.productName}`, keywords: 'version data folder', run: () => setAboutOpen(true) },
  ];

  const latest = useRef({ commands, paletteOpen });
  useEffect(() => {
    latest.current = { commands, paletteOpen };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const { commands: list, paletteOpen: palette } = latest.current;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (matches(event, SHORTCUTS.palette)) {
        event.preventDefault();
        setPaletteOpen(!palette);
        return;
      }
      if (palette) return;
      const command = list.find((c) => c.shortcut && matches(event, c.shortcut));
      if (!command) return;
      event.preventDefault();
      if (command.disabled) return;
      command.run();
      if (command.focus) focusField(command.focus);
    }
    // A request from the desktop shell (a second launch with --show-about).
    const showAbout = () => setAboutOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('app-show-about', showAbout);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('app-show-about', showAbout);
    };
  }, []);

  // Start in the field a person needs first.
  const startField = useRef(draft.title ? FIELD.body : FIELD.title);
  useEffect(() => {
    if (document.activeElement === document.body) document.getElementById(startField.current)?.focus();
  }, []);

  const cli = boot.about?.cli;
  const about: Array<[string, string]> = [
    [config.productName, boot.about?.appVersion ?? 'Development build'],
    ['Saved work', boot.about?.dataDir ?? 'This browser'],
    ['Command-line tool', !cli?.configured ? 'Not set up' : cli.version ? cli.version : (cli.detail ?? 'Not found')],
  ];

  return (
    <Tooltip.Provider delay={500} closeDelay={0} timeout={400}>
      <div className="app">
        <TitleBar
          title={draft.title.trim() || (note.blank ? 'New note' : 'Untitled note')}
          theme={theme}
          railOpen={railShown}
          onToggleTheme={toggleTheme}
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleRail={() => setRailOpen(!railOpen)}
        />
        <div className="workspace">
          <main className="card">
            <div className="row focus-mark">
              <label className="row-label" htmlFor={FIELD.title}>
                Title
              </label>
              <input
                id={FIELD.title}
                className="bare h-(--control-sm) text-body"
                value={draft.title}
                placeholder="Untitled"
                autoComplete="off"
                onChange={(event) => note.edit({ title: event.target.value })}
              />
            </div>
            <div className="focus-mark body-mark relative flex min-h-0 flex-1">
              <textarea
                id={FIELD.body}
                className="bare measure h-full resize-none px-5 py-4 text-reading"
                value={draft.body}
                placeholder="Write here"
                aria-label="Note"
                onChange={(event) => note.edit({ body: event.target.value })}
              />
            </div>
            <footer className="hair-t flex flex-none items-center gap-2 px-5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-fg-3" data-footer-status="" aria-live="polite">
                {note.savedAt ? `Saved at ${formatTime(note.savedAt)}` : 'Nothing to save yet'}
              </span>
              <Tip label="Clear note" keys={keysOf(SHORTCUTS.clear)}>
                <button id="action-clear" type="button" className="btn btn-secondary" disabled={note.blank} onClick={clearNote}>
                  Clear
                </button>
              </Tip>
            </footer>
          </main>

          <aside className="rail" data-open={railShown} inert={!railShown} aria-label="Items">
            <div className="focus-mark relative flex h-11 flex-none items-center gap-2.5 px-4">
              <Search size={16} strokeWidth={1.75} className="flex-none text-fg-3" aria-hidden="true" />
              <input
                id={FIELD.filter}
                className="bare h-full"
                value={filter}
                placeholder="Filter items"
                aria-label="Filter items"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
            {rows.length > 0 ? (
              <ItemList rows={rows} label={query ? 'Matching items' : 'All items'} onPick={addItem} />
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-fg-2">No item matches “{filter.trim()}”.</p>
                <button type="button" className="btn btn-secondary mt-3" onClick={() => setFilter('')}>
                  Show all items
                </button>
              </div>
            )}
          </aside>
        </div>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />

        <Dialog.Root open={aboutOpen} onOpenChange={setAboutOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="scrim dialog-scrim" />
            <Dialog.Popup className="dialog">
              <Dialog.Title className="text-subhead font-semibold">About {config.productName}</Dialog.Title>
              <Dialog.Description className="mt-2 text-fg-2">{config.description}</Dialog.Description>
              <dl className="facts mt-4" data-about="">
                {about.map(([label, value]) => (
                  <div key={label} className="px-3 py-2">
                    <dt className="text-small text-fg-3">{label}</dt>
                    <dd className="selectable mt-0.5 wrap-anywhere">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex justify-end">
                <Dialog.Close className="btn btn-secondary">Close</Dialog.Close>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>

        <Toaster />
      </div>
    </Tooltip.Provider>
  );
}
