'use client';

import type { ActivityLog } from '../../lib/api';
import { ActionBadge, RoleBadge } from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { TableSkeleton } from '../ui/Skeleton';

interface AuditTrailTableProps {
  logs: ActivityLog[];
  loading: boolean;
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function ChangeCell({ oldValue, newValue }: { oldValue: string | null; newValue: string | null }) {
  if (!oldValue && !newValue) {
    return <span className="text-[var(--text-muted)]">—</span>;
  }
  return (
    <div className="space-y-0.5 max-w-xs">
      {oldValue && (
        <p className="text-xs text-[var(--text-muted)] truncate" title={oldValue}>
          <span className="font-medium">From:</span> {oldValue}
        </p>
      )}
      {newValue && (
        <p className="text-xs text-[var(--text-secondary)] truncate" title={newValue}>
          <span className="font-medium">To:</span> {newValue}
        </p>
      )}
    </div>
  );
}

export default function AuditTrailTable({ logs, loading }: AuditTrailTableProps) {
  if (loading) return <TableSkeleton rows={8} />;

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState
          title="No activity yet"
          description="Actions across tasks and team management will appear here for all users."
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="grid">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                When
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Actor
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Action
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Target
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Change
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {logs.map((row) => (
              <tr key={row.id} className="hover:bg-[var(--surface-2)] transition-colors">
                <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                  {formatWhen(row.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(row.actorName ?? row.actorEmail ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate">
                        {row.actorName ?? `User #${row.actorId}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {row.actorRole && <RoleBadge role={row.actorRole} />}
                        {row.actorEmail && (
                          <span className="text-xs text-[var(--text-muted)] truncate">{row.actorEmail}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ActionBadge action={row.actionType} />
                </td>
                <td className="px-4 py-3">
                  {row.taskId != null ? (
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-primary)] truncate max-w-[14rem]" title={row.taskTitle ?? undefined}>
                        {row.taskTitle ?? `Task #${row.taskId}`}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] font-mono">#{row.taskId}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">Team / system</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ChangeCell oldValue={row.oldValue} newValue={row.newValue} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
