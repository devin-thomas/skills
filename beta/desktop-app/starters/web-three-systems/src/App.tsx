import { Dialog } from '@base-ui/react/dialog';
import { Tooltip } from '@base-ui/react/tooltip';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import config from '../app.config.json';
import type { Bootstrap, DesktopBridge, Platform } from './bridge';
import { CommandPalette, type Command } from './components/CommandPalette';
import { ItemList, type Item } from './components/ItemList';
import { StatusBar } from './components/StatusBar';
import { TitleBar } from './components/TitleBar';
import { Toaster } from './components/Toaster';
import { Tip, formatTime } from './components/ui';
import { useDraft } from './state/draft';
import { cancelExample, jobRunning, runExample, useJob, useTool } from './state/job';
import { SHORTCUTS, keysOf, matches, type CommandId } from './state/shortcuts';
import { toast } from './state/toast';

// The starter screen: a note with a title and a body, beside a 10,000-row list
// whose rows can be added to the note, and a status bar that runs an example
// job through the bundled tool. It exists so the shell, the tokens, the audit
// and the measurements have something real to run against on day one. Replace
// it with the app's own screens and keep the parts around it: the command
// registry with its ids from shortcuts.json, the saved draft, the title bar,
// the status bar's one height, and the stand-in bridge.

type Theme = 'light' | 'dark';

function useTheme(desktop: DesktopBridge): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  // Keep the window's own colours (background, window-button glyphs) in step with the page.
  useEffect(() => {
    desktop.setTheme(theme);
  }, [desktop, theme]);
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
  if (document.activeElement === el) return;
  // The element may not be rendered yet: try once more next frame, but only if focus has not moved
  // since. A dialog opened in between (a shortcut pressed straight after) keeps its focus.
  const from = document.activeElement;
  requestAnimationFrame(() => {
    if (document.activeElement === from || document.activeElement === document.body) document.getElementById(id)?.focus();
  });
}

const WORDS = ['Amber', 'Birch', 'Cedar', 'Delta', 'Ember', 'Flint', 'Grove', 'Harbor', 'Indigo', 'Juniper', 'Kestrel', 'Lumen', 'Meadow', 'Nimbus', 'Orchard', 'Pebble'];

function makeItems(count: number): Item[] {
  const out: Item[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ id: `item-${i}`, label: `${WORDS[i % WORDS.length]} ${WORDS[(i * 7 + 3) % WORDS.length]} ${i + 1}`, detail: `${((i * 37) % 900) + 100} KB` });
  }
  return out;
}

export function App({ boot, desktop, platform }: { boot: Bootstrap; desktop: DesktopBridge; platform: Platform }) {
  const note = useDraft();
  const { draft } = note;
  const [theme, toggleTheme] = useTheme(desktop);
  const narrow = useNarrow();
  const job = useJob();
  const tool = useTool();
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

  // The command list is the single registry: the palette shows it, the key
  // handler and the shell's menu run it by id. A command a person repeats
  // carries a shortcut from shortcuts.json.
  const running = job.phase === 'running';
  const cmd = (id: CommandId, rest: Omit<Command, 'id' | 'shortcut'>): Command => ({ id, shortcut: SHORTCUTS[id] ?? undefined, ...rest });
  const commands: Command[] = [
    cmd('focus-title', { group: 'Go to', label: 'Title', keywords: 'focus', focus: FIELD.title, run: () => {} }),
    cmd('focus-body', { group: 'Go to', label: 'Note', keywords: 'body text focus', focus: FIELD.body, run: () => {} }),
    cmd('show-items', { group: 'Go to', label: `All ${items.length.toLocaleString('en-US')} items`, keywords: 'list filter browse', run: showItems }),
    cmd('clear-note', { group: 'Note', label: 'Clear note', keywords: 'discard delete', disabled: note.blank, focus: FIELD.title, run: clearNote }),
    cmd('run-example', { group: 'Example', label: 'Run the example', keywords: 'job start', disabled: running, run: () => void runExample() }),
    cmd('cancel-example', { group: 'Example', label: 'Cancel the example', keywords: 'stop job', disabled: !running, run: cancelExample }),
    cmd('toggle-theme', { group: 'View', label: theme === 'dark' ? 'Use the light theme' : 'Use the dark theme', keywords: 'appearance dark light', run: toggleTheme }),
    cmd('about', { group: 'View', label: `About ${config.productName}`, keywords: 'version data folder', run: () => setAboutOpen(true) }),
  ];

  const latest = useRef({ commands, paletteOpen });
  useEffect(() => {
    latest.current = { commands, paletteOpen };
  });

  // The shell's menu dims exactly the commands whose shortcut would do nothing now.
  const menuState = JSON.stringify(Object.fromEntries(commands.map((c) => [c.id, !c.disabled])));
  useEffect(() => {
    desktop.setMenuState(JSON.parse(menuState));
  }, [desktop, menuState]);

  useEffect(() => {
    function runCommand(command: Command | undefined) {
      if (!command || command.disabled) return;
      command.run();
      if (command.focus) focusField(command.focus);
    }
    function onKeyDown(event: KeyboardEvent) {
      const { commands: list, paletteOpen: palette } = latest.current;
      if (matches(event, SHORTCUTS['command-palette'])) {
        event.preventDefault();
        setPaletteOpen(!palette);
        return;
      }
      if (palette) return;
      const command = list.find((c) => c.shortcut && matches(event, c.shortcut));
      if (!command) return;
      event.preventDefault();
      runCommand(command);
    }
    // A command from the shell: the menu bar, the Dock menu, a script through the control channel.
    const off = desktop.onMenuCommand((id) => {
      if (id === 'command-palette') setPaletteOpen(true);
      else runCommand(latest.current.commands.find((c) => c.id === id));
    });
    // A request from the desktop shell (--show-about through the control channel).
    const showAbout = () => setAboutOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('app-show-about', showAbout);
    return () => {
      off();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('app-show-about', showAbout);
    };
  }, [desktop]);

  // Start in the field a person needs first.
  const startField = useRef(draft.title ? FIELD.body : FIELD.title);
  useEffect(() => {
    if (document.activeElement === document.body) document.getElementById(startField.current)?.focus();
  }, []);

  const about: Array<[string, string]> = [
    [config.productName, boot.about?.appVersion ?? 'Development build'],
    ['Saved work', boot.about?.dataDir ?? 'Kept on this computer'],
  ];

  return (
    <Tooltip.Provider delay={500} closeDelay={0} timeout={400}>
      <div className="app" data-running={jobRunning() ? '' : undefined}>
        <TitleBar
          title={draft.title.trim() || (note.blank ? 'New note' : 'Untitled note')}
          theme={theme}
          platform={platform}
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
              <Tip label="Clear note" keys={keysOf(SHORTCUTS['clear-note'])}>
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

        <StatusBar job={job} tool={tool} />

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
