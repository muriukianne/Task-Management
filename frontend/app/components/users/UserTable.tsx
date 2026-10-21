'use client';

import Link from 'next/link';
import type { AppUser } from '../../lib/api';
import { RoleBadge } from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { TableSkeleton } from '../ui/Skeleton';

interface UserTableProps {
  users:       AppUser[];
  loading:     boolean;
  emptyAction?: React.ReactNode;
  onView?:     (user: AppUser) => void;
  onEdit?:     (user: AppUser) => void;
  onDelete?:   (user: AppUser) => void;
}

export default function UserTable({
  users, loading, emptyAction, onView, onEdit, onDelete,
}: UserTableProps) {
  if (loading) return <TableSkeleton rows={5} />;

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState
          title="No team members yet"
          description="Create accounts to add employees and supervisors to your team."
          action={emptyAction}
        />
      </div>
    );
  }

  const showActions = Boolean(onEdit || onDelete || onView);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="grid">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Member
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Email
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Role
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                ID
              </th>
              {showActions && (
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                onClick={() => onView?.(user)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {user.firstName.charAt(0).toUpperCase()}
                    </div>
                    {onView ? (
                      <Link
                        href={`/supervisor/users/${user.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        {user.firstName} {user.lastName}
                      </Link>
                    ) : (
                      <span className="font-medium text-[var(--text-primary)]">
                        {user.firstName} {user.lastName}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{user.email}</td>
                <td className="px-4 py-3">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-muted)] font-mono">
                  {user.id}
                  {user.clerkId ? (
                    <span className="ml-2 text-[var(--text-muted)]/70" title={user.clerkId}>linked</span>
                  ) : (
                    <span className="ml-2 text-[var(--warning)]">invited</span>
                  )}
                </td>
                {showActions && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {onView && (
                        <Link
                          href={`/supervisor/users/${user.id}`}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors"
                        >
                          View
                        </Link>
                      )}
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(user)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(user)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
