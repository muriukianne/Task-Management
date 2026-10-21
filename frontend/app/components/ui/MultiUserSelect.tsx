'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { AppUser } from '../../lib/api';
import UserAvatar from './UserAvatar';

interface MultiUserSelectProps {
  users: AppUser[];
  value: number[];
  onChange: (userIds: number[]) => void;
  /** User ids that cannot be selected (e.g. the lead). */
  excludeIds?: number[];
  disabled?: boolean;
  placeholder?: string;
  emptyHint?: string;
  id?: string;
  label?: string;
}

function truncateEmail(email: string, max = 28) {
  if (email.length <= max) return email;
  return `${email.slice(0, max - 1)}…`;
}

export default function MultiUserSelect({
  users,
  value,
  onChange,
  excludeIds = [],
  disabled = false,
  placeholder = 'Add co-assignees…',
  emptyHint = 'No employees available.',
  id,
}: MultiUserSelectProps) {
  const autoId = useId();
  const triggerId = id ?? `multi-user-${autoId}`;
  const listId = `${triggerId}-listbox`;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const exclude = new Set(excludeIds);

  const available = users.filter((u) => !exclude.has(u.id));
  const selected = available.filter((u) => value.includes(u.id));
  const unselected = available.filter((u) => !value.includes(u.id));
  const isDisabled = disabled || available.length === 0;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle(userId: number) {
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  }

  function remove(userId: number) {
    onChange(value.filter((id) => id !== userId));
  }

  return (
    <div ref={rootRef} className="relative space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] pl-1.5 pr-1 py-1 text-xs"
            >
              <UserAvatar firstName={u.firstName} lastName={u.lastName} email={u.email} size="sm" />
              <span className="font-medium text-[var(--text-primary)] max-w-[8rem] truncate">
                {u.firstName} {u.lastName}
              </span>
              <button
                type="button"
                onClick={() => remove(u.id)}
                disabled={disabled}
                className="w-5 h-5 rounded-md text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                aria-label={`Remove ${u.firstName}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        id={triggerId}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={[
          'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)]',
          'px-3 py-2 text-sm text-left text-[var(--text-primary)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
          'transition-all duration-200 flex items-center gap-2.5',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          open ? 'ring-2 ring-[var(--accent)] border-transparent' : 'hover:border-[var(--border-2)]',
        ].join(' ')}
      >
        <span className="flex-1 text-[var(--text-muted)]">
          {available.length === 0
            ? '— No employees left —'
            : unselected.length === 0
              ? 'All available members selected'
              : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {available.length === 0 && emptyHint && (
        <p className="text-xs text-[var(--text-muted)]">{emptyHint}</p>
      )}

      {open && unselected.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable
          aria-labelledby={triggerId}
          className={[
            'absolute z-50 mt-1.5 w-full max-h-56 overflow-auto',
            'rounded-xl border border-zinc-200/50 dark:border-zinc-800/40',
            'bg-[var(--surface)] shadow-lg py-1 animate-fade-in',
          ].join(' ')}
        >
          {unselected.map((u) => (
            <li key={u.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface-2)] transition-colors"
              >
                <UserAvatar firstName={u.firstName} lastName={u.lastName} email={u.email} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-[var(--text-primary)] truncate">
                    {u.firstName} {u.lastName}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)] truncate">
                    {truncateEmail(u.email)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
