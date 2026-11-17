import { useSyncExternalStore } from 'react';

// Tracks whether the last action came from the keyboard or a pointer, and
// whether the window is active. Both are mirrored onto <html> so CSS can skip
// entrance motion for keyboard actions and dim the title bar when inactive.

export type Modality = 'keyboard' | 'pointer';

let modality: Modality = 'pointer';
const listeners = new Set<() => void>();

function set(next: Modality) {
  if (next === modality) return;
  modality = next;
  document.documentElement.dataset.modality = next;
  listeners.forEach((l) => l());
}

export function installWindowTracking() {
  const root = document.documentElement;
  root.dataset.modality = modality;
  root.dataset.window = 'active';
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Shift' && event.key !== 'Control' && event.key !== 'Alt' && event.key !== 'Meta') {
        set('keyboard');
      }
    },
    true,
  );
  window.addEventListener('pointerdown', () => set('pointer'), true);
  window.addEventListener('pointermove', () => set('pointer'), { capture: true, passive: true });
  window.addEventListener('blur', () => {
    root.dataset.window = 'inactive';
  });
  window.addEventListener('focus', () => {
    root.dataset.window = 'active';
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useModality(): Modality {
  return useSyncExternalStore(subscribe, () => modality, () => modality);
}
