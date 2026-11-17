import { useSyncExternalStore } from 'react';

export interface ToastItem {
  id: number;
  title: string;
  action?: { label: string; run: () => void };
  /** True once the toast has been asked to leave; it is removed after its exit. */
  leaving: boolean;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toast(input: { title: string; action?: ToastItem['action'] }) {
  // One message at a time keeps the stack out of the way of the work.
  items = [...items.map((t) => ({ ...t, leaving: true })), { id: nextId++, leaving: false, ...input }];
  emit();
}

export function dismissToast(id: number) {
  if (!items.some((t) => t.id === id && !t.leaving)) return;
  items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
}

export function removeToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, () => items, () => items);
}
