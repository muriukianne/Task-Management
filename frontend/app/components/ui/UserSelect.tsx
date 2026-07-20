'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { AppUser } from '../../lib/api';
import UserAvatar from './UserAvatar';

interface UserSelectProps {
  users: AppUser[];
  value: number | '';
  onChange: (userId: number) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyHint?: string;
  id?: string;
}

function truncateEmail(email: string, max = 28) {
  if (email.length <= max) return email;
  return `${email.slice(0, max - 1)}…`;
}

export default function UserSelect({
  users,
  value,
  onChange,
  name = 'assignedTo',
  required = false,
  disabled = false,
  placeholder = '— Select member —',
  emptyHint = 'No employees available yet.',
  id,
}: UserSelectProps) {
  const autoId = useId();
  const triggerId = id ?? `user-select-${autoId}`;
  const listId = `${triggerId}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = typeof value === 'number'
    ? users.find((u) => u.id === value) ?? null
    : null;
  const isDisabled = disabled || users.length === 0;

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

  useEffect(() => {
    if (!open) return;
    const idx = typeof value === 'number'
      ? Math.max(0, users.findIndex((u) => u.id === value))
      : 0;
    setActiveIndex(users.length ? idx : -1);
  }, [open, users, value]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function selectUser(userId: number) {
    onChange(userId);
    setOpen(false);
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (isDisabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(users.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectUser(users[activeIndex].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(users.length - 1);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="hidden"
        name={name}
        value={typeof value === 'number' ? String(value) : ''}
        required={required}
      />

      <button
        type="button"
        id={triggerId}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={[
          'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)]',
          'px-3 py-2 text-sm text-left text-[var(--text-primary)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
          'transition-all duration-200 flex items-center gap-2.5',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          open ? 'ring-2 ring-[var(--accent)] border-transparent' : 'hover:border-[var(--border-2)]',
        ].join(' ')}
      >
        {selected ? (
          <>
            <UserAvatar
              firstName={selected.firstName}
              lastName={selected.lastName}
              email={selected.email}
              size="sm"
            />
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">
                {selected.firstName} {selected.lastName}
              </span>
              <span className="block text-xs text-[var(--text-muted)] truncate">
                {truncateEmail(selected.email)}
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-[var(--text-muted)]">
            {users.length === 0 ? '— No employees yet —' : placeholder}
          </span>
        )}
        <svg
          className={`w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {users.length === 0 && emptyHint && (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">{emptyHint}</p>
      )}

      {open && users.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={triggerId}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className={[
            'absolute z-50 mt-1.5 w-full max-h-56 overflow-auto',
            'rounded-xl border border-zinc-200/50 dark:border-zinc-800/40',
            'bg-[var(--surface)] shadow-lg',
            'py-1 animate-fade-in',
            'focus:outline-none',
          ].join(' ')}
        >
          {users.map((u, i) => {
            const isSelected = u.id === value;
            const isActive = i === activeIndex;
            return (
              <li
                key={u.id}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => selectUser(u.id)}
                className={[
                  'flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors',
                  isActive || isSelected
                    ? 'bg-[var(--accent-subtle)]'
                    : 'hover:bg-[var(--surface-2)]',
                ].join(' ')}
              >
                <UserAvatar
                  firstName={u.firstName}
                  lastName={u.lastName}
                  email={u.email}
                  size="sm"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-[var(--text-primary)] truncate">
                    {u.firstName} {u.lastName}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)] truncate">
                    {truncateEmail(u.email)}
                  </span>
                </span>
                {isSelected && (
                  <svg className="w-4 h-4 text-[var(--accent)] shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
