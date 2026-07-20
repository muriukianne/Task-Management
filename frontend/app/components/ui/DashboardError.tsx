'use client';

import { useEffect } from 'react';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Shared dashboard error boundary UI — used by employee & supervisor `error.tsx`.
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error('[TaskFlow] dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div
        className={[
          'w-full max-w-md rounded-2xl border border-zinc-200/50 dark:border-zinc-800/40',
          'bg-[var(--surface)] shadow-lg p-8 text-center animate-fade-in',
        ].join(' ')}
      >
        <div className="relative mx-auto mb-6 w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-[var(--accent)]/40 animate-radar" />
          <div className="w-12 h-12 rounded-2xl bg-[var(--error-subtle)] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path
                d="M14 5l10 18H4L14 5z"
                stroke="var(--error)"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M14 12v5M14 19.5h.01" stroke="var(--error)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Lost connection to the control tower
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          {error.message?.includes('control tower') || error.message?.includes('fetch')
            ? error.message
            : 'We could not reach the TaskFlow API. Check your connection and try again.'}
        </p>

        <button
          type="button"
          onClick={reset}
          className={[
            'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl',
            'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold',
            'active:scale-95 transition-transform duration-150',
            'animate-cta-pulse',
          ].join(' ')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M2 7a5 5 0 019.5-2.2M12 7a5 5 0 01-9.5 2.2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path d="M11.5 2v3h-3M2.5 12v-3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Retry connection
        </button>
      </div>
    </div>
  );
}
