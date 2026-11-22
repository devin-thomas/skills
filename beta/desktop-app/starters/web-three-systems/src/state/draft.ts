import { useEffect, useRef, useState } from 'react';
import config from '../../app.config.json';
import { read, write } from './storage';

// The starter's one document: a title and a body. Replace it with the app's own
// state, and keep the save rule: every change is saved within 250 ms, and at
// once when the window loses focus or is hidden, so a kill loses at most the
// last moment of typing (qa/kill-test.ts checks this in the real shell).

export const DRAFT_KEY = `${config.storagePrefix}.draft.v1`;

export interface Draft {
  title: string;
  body: string;
}

interface StoredDraft extends Draft {
  v: 1;
  savedAt: number | null;
}

const EMPTY: Draft = { title: '', body: '' };

function restore(): { draft: Draft; savedAt: number | null } {
  const stored = read<StoredDraft>(DRAFT_KEY);
  if (stored?.v !== 1 || typeof stored.title !== 'string' || typeof stored.body !== 'string') return { draft: EMPTY, savedAt: null };
  return { draft: { title: stored.title, body: stored.body }, savedAt: stored.savedAt };
}

export function useDraft() {
  const [initial] = useState(restore);
  const [draft, setDraft] = useState<Draft>(initial.draft);
  const [savedAt, setSavedAt] = useState<number | null>(initial.savedAt);
  const restored = useRef(true);
  const lastSave = useRef(0);

  useEffect(() => {
    // The first run is the restored state itself: nothing new to save.
    if (restored.current) {
      restored.current = false;
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      timer = null;
      lastSave.current = performance.now();
      const at = draft.title || draft.body ? Date.now() : null;
      const ok = write(DRAFT_KEY, { v: 1, ...draft, savedAt: at } satisfies StoredDraft);
      setSavedAt(ok ? at : null);
    };
    const flush = () => {
      if (timer !== null) {
        clearTimeout(timer);
        save();
      }
    };
    const sinceLast = performance.now() - lastSave.current;
    timer = setTimeout(save, Math.min(200, Math.max(30, 250 - sinceLast)));
    window.addEventListener('blur', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener('blur', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [draft]);

  return {
    draft,
    savedAt,
    blank: !draft.title && !draft.body,
    edit: (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })),
    replace: (next: Draft) => setDraft(next),
    clear: () => setDraft(EMPTY),
  };
}
