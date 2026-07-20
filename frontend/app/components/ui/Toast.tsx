'use client';

import { useToast, type ToastItem } from '../providers/ToastContext';

const ICONS: Record<string, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

const STYLES: Record<string, string> = {
  success: 'border-[var(--success)] bg-[var(--success-subtle)]',
  error:   'border-[var(--error)]   bg-[var(--error-subtle)]',
  warning: 'border-[var(--warning)] bg-[var(--warning-subtle)]',
  info:    'border-[var(--info)]    bg-[var(--info-subtle)]',
};

const ICON_STYLES: Record<string, string> = {
  success: 'bg-[var(--success)] text-white',
  error:   'bg-[var(--error)]   text-white',
  warning: 'bg-[var(--warning)] text-white',
  info:    'bg-[var(--info)]    text-white',
};

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'flex items-start gap-3 w-80 rounded-xl border p-4',
        'shadow-[var(--shadow-lg)] backdrop-blur-sm',
        STYLES[toast.variant],
        toast.exiting ? 'animate-toast-out' : 'animate-toast-in',
      ].join(' ')}
    >
      <span
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${ICON_STYLES[toast.variant]}`}
      >
        {ICONS[toast.variant]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-sm"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
