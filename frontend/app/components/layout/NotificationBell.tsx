'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '../../lib/api';

const POLL_MS = 30_000;

interface NotificationBellProps {
  /** Called when user clicks a notification that references a task. */
  onOpenTask?: (taskId: number) => void;
  enabled?: boolean;
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T')).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'COMMENT_ADDED': return '💬';
    case 'TASK_REJECTED': return '↩';
    case 'STATUS_CHANGED': return '↻';
    case 'ASSIGNEE_CHANGED': return '→';
    case 'TASK_CREATED': return '✦';
    case 'FILE_UPLOADED': return '📎';
    case 'DUE_SOON': return '⏰';
    case 'DUE_TODAY': return '⚠';
    case 'OVERDUE': return '‼';
    case 'LEAD_APPROVAL_PENDING': return '✓';
    default: return '•';
  }
}

export default function NotificationBell({ onOpenTask, enabled = true }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [countRes, listRes] = await Promise.all([
        getUnreadNotificationCount(),
        getNotifications({ page: 0, size: 20 }),
      ]);
      setUnread(countRes.count);
      setItems(listRes.content);
    } catch {
      // Keep last known state on transient failures (token race, offline)
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  }

  async function handleClickItem(n: AppNotification) {
    try {
      if (!n.read) {
        await markNotificationRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
        setUnread((c) => Math.max(0, c - 1));
      }
    } catch {
      // still allow navigation
    }
    setOpen(false);
    if (n.taskId != null && onOpenTask) {
      onOpenTask(n.taskId);
    }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch {
      // ignore
    }
  }

  if (!enabled) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => void handleOpen()}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path
            d="M9 2.5a4 4 0 00-4 4v2.2c0 .5-.2 1-.5 1.4L3.2 12.2c-.4.5-.1 1.3.6 1.3h10.4c.7 0 1-.8.6-1.3l-1.3-2.1c-.3-.4-.5-.9-.5-1.4V6.5a4 4 0 00-4-4z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M7.5 14.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg z-50 overflow-hidden animate-fade-in"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">
                No notifications yet
              </p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void handleClickItem(n)}
                      className={[
                        'w-full text-left px-3 py-2.5 border-b border-[var(--border)] last:border-0 transition-colors',
                        n.read
                          ? 'hover:bg-[var(--surface-2)]'
                          : 'bg-[var(--accent-subtle)] hover:bg-[var(--accent-subtle)]',
                      ].join(' ')}
                    >
                      <div className="flex gap-2.5">
                        <span className="text-sm mt-0.5 w-5 text-center flex-shrink-0" aria-hidden>
                          {typeIcon(n.type)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm truncate ${n.read ? 'text-[var(--text-secondary)]' : 'font-semibold text-[var(--text-primary)]'}`}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-0.5">{n.body}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {n.actorName && (
                              <span className="text-[10px] text-[var(--text-muted)] truncate">{n.actorName}</span>
                            )}
                            <span className="text-[10px] text-[var(--text-muted)] ml-auto whitespace-nowrap">
                              {fmtWhen(n.createdAt)}
                            </span>
                          </div>
                        </div>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
