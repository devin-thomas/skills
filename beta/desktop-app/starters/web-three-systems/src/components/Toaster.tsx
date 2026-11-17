import { useEffect } from 'react';
import { dismissToast, removeToast, useToasts, type ToastItem } from '../state/toast';

const VISIBLE_MS = 5000;
const EXIT_MS = 200;

function Toast({ item }: { item: ToastItem }) {
  const { id, leaving } = item;

  // Auto-dismiss, but never while the window is hidden.
  useEffect(() => {
    if (leaving) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(() => dismissToast(id), VISIBLE_MS);
    };
    arm();
    document.addEventListener('visibilitychange', arm);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [id, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => removeToast(id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [id, leaving]);

  return (
    <div className="toast" data-leaving={leaving} data-toast="">
      <span className="min-w-0 py-1">{item.title}</span>
      {item.action ? (
        <button
          type="button"
          className="toast-action"
          tabIndex={leaving ? -1 : 0}
          onClick={() => {
            item.action?.run();
            dismissToast(id);
          }}
        >
          {item.action.label}
        </button>
      ) : (
        <span className="w-2" />
      )}
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="toaster" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((item) => (
        <Toast key={item.id} item={item} />
      ))}
    </div>
  );
}
