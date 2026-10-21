'use client';

import type { Task, AppUser } from '../../lib/api';
import { StatusBadge, PriorityBadge, DueBadge } from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import { TableSkeleton } from '../ui/Skeleton';
import type { SortField, SortDir } from './TaskFilters';

interface Column { field: SortField; label: string; }

const COLUMNS: Column[] = [
  { field: 'taskTitle',  label: 'Title'       },
  { field: 'status',     label: 'Status'      },
  { field: 'priority',   label: 'Priority'    },
  { field: 'updatedAt',  label: 'Updated'     },
  { field: 'dueDate',    label: 'Due Date'    },
];

interface TaskTableProps {
  tasks:         Task[];
  users:         AppUser[];
  loading:       boolean;
  sortField:     SortField;
  sortDir:       SortDir;
  role:          string;
  busyTaskId?:   number | null;
  onSort:        (f: SortField, d: SortDir) => void;
  onRowClick:    (task: Task) => void;
  onConfirmDone: (task: Task) => void;
  onReject?:     (task: Task) => void;
  onReAssign:    (task: Task) => void;
  onStatusUp:    (task: Task, status: string) => void;
  emptyAction?:  React.ReactNode;
  emptyDescription?: string;
}

function getUserName(users: AppUser[], id: number) {
  const u = users.find((x) => x.id === id);
  return u ? `${u.firstName} ${u.lastName}` : `#${id}`;
}

function teamLabel(task: Task, users: AppUser[]) {
  const assignees = task.assignees ?? [];
  if (assignees.length === 0) {
    return getUserName(users, task.assignedTo);
  }
  const lead = assignees.find((a) => a.role === 'LEAD') ?? assignees[0];
  const coCount = assignees.filter((a) => a.role !== 'LEAD').length;
  const leadName = lead.firstName
    ? `${lead.firstName} ${lead.lastName ?? ''}`.trim()
    : getUserName(users, lead.userId);
  return coCount > 0 ? `${leadName} +${coCount}` : leadName;
}

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="w-3 h-3 inline-block opacity-20">↕</span>;
  return <span className="w-3 h-3 inline-block text-[var(--accent)]">{dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function TaskTable({
  tasks, users, loading, sortField, sortDir, role, busyTaskId = null,
  onSort, onRowClick, onConfirmDone, onReject, onReAssign, onStatusUp,
  emptyAction,
  emptyDescription = 'No tasks found. Create your first task to get started!',
}: TaskTableProps) {
  if (loading) return <TableSkeleton rows={6} />;

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/40 bg-[var(--surface)] shadow-sm">
        <EmptyState
          title="Clear skies ahead"
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  function handleSortClick(field: SortField) {
    if (sortField === field) {
      onSort(field, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(field, 'asc');
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200/50 dark:border-zinc-800/40 bg-[var(--surface)] overflow-hidden animate-fade-in shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="grid">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              {COLUMNS.map(({ field, label }, i) => (
                <th
                  key={`${field}-${i}`}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide whitespace-nowrap"
                >
                  <button
                    onClick={() => handleSortClick(field)}
                    className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
                  >
                    {label}
                    <SortIcon active={sortField === field} dir={sortDir} />
                  </button>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {tasks.map((task) => (
              <tr
                key={task.taskId}
                className="group hover:bg-[var(--surface-2)] transition-colors"
              >
                {/* Title + assignee */}
                <td className="px-4 py-3 max-w-[260px]">
                  <button
                    onClick={() => onRowClick(task)}
                    className="text-left hover:text-[var(--accent)] transition-colors"
                  >
                    <p className="font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent)]">
                      {task.taskTitle}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                      {teamLabel(task, users)}
                      {task.blocked ? ' · blocked' : ''}
                    </p>
                  </button>
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={task.status} />
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  <PriorityBadge priority={task.priority ?? 'medium'} />
                </td>

                <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--text-secondary)]">
                  {fmt(task.updatedAt)}
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  <DueBadge dueDate={task.dueDate} status={task.status} />
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end flex-wrap">
                    {/* Supervisor/Admin actions */}
                    {(role === 'supervisor' || role === 'admin') && task.status === 'resolved' && (
                      <>
                        <button
                          type="button"
                          disabled={busyTaskId === task.taskId}
                          onClick={() => onConfirmDone(task)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                        >
                          Confirm Done
                        </button>
                        {onReject && (
                          <button
                            type="button"
                            disabled={busyTaskId === task.taskId}
                            onClick={() => onReject(task)}
                            className="px-2.5 py-1 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                      </>
                    )}
                    {(role === 'supervisor' || role === 'admin') &&
                     (task.status === 'created' || task.status === 'assigned' || task.status === 'resolved') && (
                      <button
                        type="button"
                        onClick={() => onReAssign(task)}
                        className="px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-xs font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      >
                        Reassign
                      </button>
                    )}

                    {/* Employee actions */}
                    {role === 'employee' && task.status === 'assigned' && (
                      <button
                        type="button"
                        disabled={busyTaskId === task.taskId || Boolean(task.blocked)}
                        title={task.blocked ? 'Blocked by unfinished dependencies' : undefined}
                        onClick={() => onStatusUp(task, 'in_progress')}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        {busyTaskId === task.taskId ? '…' : task.blocked ? 'Blocked' : 'Start'}
                      </button>
                    )}
                    {role === 'employee' && task.status === 'in_progress' && task.viewerAssigneeRole === 'CO_ASSIGNEE' && (
                      <button
                        type="button"
                        disabled={busyTaskId === task.taskId}
                        onClick={() => onStatusUp(task, 'pending_approval')}
                        className="px-2.5 py-1 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
                      >
                        {busyTaskId === task.taskId ? '…' : 'Submit'}
                      </button>
                    )}
                    {role === 'employee' && task.status === 'in_progress' && task.viewerAssigneeRole !== 'CO_ASSIGNEE' && (
                      <button
                        type="button"
                        disabled={busyTaskId === task.taskId}
                        onClick={() => onStatusUp(task, 'resolved')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                      >
                        {busyTaskId === task.taskId ? '…' : 'Resolve'}
                      </button>
                    )}
                    {role === 'employee' && task.status === 'pending_approval' && task.viewerAssigneeRole === 'LEAD' && (
                      <>
                        <button
                          type="button"
                          disabled={busyTaskId === task.taskId}
                          onClick={() => onStatusUp(task, 'resolved')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                        >
                          {busyTaskId === task.taskId ? '…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          disabled={busyTaskId === task.taskId}
                          onClick={() => onStatusUp(task, 'in_progress')}
                          className="px-2.5 py-1 rounded-lg border border-orange-300 text-orange-700 text-xs font-semibold hover:bg-orange-50 transition-colors disabled:opacity-50"
                        >
                          Send back
                        </button>
                      </>
                    )}

                    {/* Detail */}
                    <button
                      type="button"
                      onClick={() => onRowClick(task)}
                      aria-label="View task details"
                      className="w-7 h-7 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1v5M3.5 9.5h5M1 6a5 5 0 1010 0A5 5 0 001 6z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
