import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

// A virtualized listbox: 10,000 rows cost about as many DOM nodes as fit on
// screen. Keyboard navigation jumps and never animates.

const ROW = 40;

export interface Item {
  id: string;
  label: string;
  detail: string;
}

export function ItemList({ rows, label, onPick }: { rows: Item[]; label: string; onPick: (item: Item) => void }) {
  // TanStack Virtual hands back a mutable instance, so this component opts out
  // of the React Compiler's memoisation.
  'use no memo';
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW,
    overscan: 6,
  });
  const current = Math.min(active, rows.length - 1);

  // Where the scrollbar is an overlay that takes no space (macOS by default, some Linux
  // desktops), nothing shows at rest that more rows are below: fade the lower edge instead
  // (.scroll-cue). Where the scrollbar takes space (Windows), the list is left as it is, so the
  // scroll measured there does not pay for a mask. Read again when the window resizes.
  const [overlayBar, setOverlayBar] = useState(false);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const read = () => setOverlayBar(el.scrollHeight > el.clientHeight && el.offsetWidth - el.clientWidth === 0);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rows.length]);

  function move(to: number) {
    const next = Math.max(0, Math.min(rows.length - 1, to));
    setActive(next);
    virtualizer.scrollToIndex(next, { align: 'auto' });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const page = Math.max(1, Math.floor((scroller.current?.clientHeight ?? ROW) / ROW) - 1);
    switch (event.key) {
      case 'ArrowDown':
        move(current + 1);
        break;
      case 'ArrowUp':
        move(current - 1);
        break;
      case 'PageDown':
        move(current + page);
        break;
      case 'PageUp':
        move(current - page);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(rows.length - 1);
        break;
      case 'Enter':
      case ' ': {
        const row = rows[current];
        if (row) onPick(row);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  }

  const items = virtualizer.getVirtualItems();
  const activeRendered = items.some((item) => item.index === current);

  return (
    <div
      ref={scroller}
      className={`listbox min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]${overlayBar ? ' scroll-cue' : ''}`}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={activeRendered ? `item-option-${current}` : undefined}
      onKeyDown={onKeyDown}
      onFocus={() => {
        // Start from a row that is on screen, not one scrolled out of view.
        if (!activeRendered) setActive(Math.ceil((scroller.current?.scrollTop ?? 0) / ROW));
      }}
    >
      <div role="presentation" className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((item) => {
          const row = rows[item.index]!;
          return (
            <div
              key={row.id}
              id={`item-option-${item.index}`}
              role="option"
              aria-selected={false}
              aria-setsize={rows.length}
              aria-posinset={item.index + 1}
              data-row=""
              data-active={item.index === current}
              className="list-row"
              style={{ transform: `translateY(${item.start}px)` }}
              onClick={() => {
                setActive(item.index);
                onPick(row);
              }}
            >
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              <span className="flex-none truncate text-small text-fg-3 tabular-nums">{row.detail}</span>
              <Plus size={14} strokeWidth={1.75} className="list-row-add flex-none text-fg-3" aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
