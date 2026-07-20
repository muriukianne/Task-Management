'use client';

import type { Task, AppUser } from '../../lib/api';
import { PriorityBadge } from '../ui/Badge';
import { TaskCardSkeleton } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import UserAvatar from '../ui/UserAvatar';

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: 'created',     label: 'Created',     color: 'bg-slate-400' },
  { id: 'assigned',    label: 'Assigned',    color: 'bg-blue-500' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-amber-500' },
  { id: 'resolved',    label: 'Resolved',    color: 'bg-emerald-500' },
  { id: 'done',        label: 'Done',        color: 'bg-violet-500' },
];

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface KanbanCardProps {
  task: Task;
  users: AppUser[];
  role: string;
  busy?: boolean;
  onOpen: (task: Task) => void;
  onConfirmDone: (task: Task) => void;
  onStatusUp: (task: Task, s: string) => void;
}

function KanbanCard({ task, users, role, busy, onOpen, onConfirmDone, onStatusUp }: KanbanCardProps) {
  const assignee = users.find((u) => u.id === task.assignedTo);
  const name     = assignee ? `${assignee.firstName} ${assignee.lastName}` : '—';
  const overdue  = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(task)}
      className={[
        'p-3.5 rounded-xl cursor-pointer group animate-slide-up',
        'border border-zinc-200/50 dark:border-zinc-800/40',
        'bg-[var(--surface)] shadow-sm',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-[var(--accent)]/40',
        'transition-all duration-300 ease-out',
      ].join(' ')}
    >
      <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors mb-2 line-clamp-2">
        {task.taskTitle}
      </p>

      <div className="flex flex-wrap gap-1 mb-3">
        <PriorityBadge priority={task.priority ?? 'medium'} />
        {task.attachedFile && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-semibold">
            File
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {assignee ? (
            <UserAvatar
              firstName={assignee.firstName}
              lastName={assignee.lastName}
              email={assignee.email}
              size="sm"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)]" />
          )}
          <span className="text-xs text-[var(--text-muted)] truncate max-w-[90px]">{name}</span>
        </div>
        {task.dueDate && (
          <span className={`text-[10px] font-semibold shrink-0 ${overdue ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
            {overdue ? 'Overdue · ' : ''}{fmt(task.dueDate)}
          </span>
        )}
      </div>

      {/* Inline actions — stop propagation to avoid opening detail */}
      <div
        className="flex gap-1.5 mt-3 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/40"
        onClick={(e) => e.stopPropagation()}
      >
        {role === 'employee' && task.status === 'assigned' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatusUp(task, 'in_progress')}
            className="flex-1 py-1 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50"
          >
            {busy ? '…' : 'Start'}
          </button>
        )}
        {role === 'employee' && task.status === 'in_progress' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatusUp(task, 'resolved')}
            className="flex-1 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50"
          >
            {busy ? '…' : 'Resolve'}
          </button>
        )}
        {(role === 'supervisor' || role === 'admin') && task.status === 'resolved' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirmDone(task)}
            className="flex-1 py-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50"
          >
            {busy ? '…' : 'Confirm Done'}
          </button>
        )}
      </div>
    </div>
  );
}

interface TaskKanbanProps {
  tasks: Task[];
  users: AppUser[];
  loading: boolean;
  role: string;
  busyTaskId?: number | null;
  onOpen: (task: Task) => void;
  onConfirmDone: (task: Task) => void;
  onStatusUp: (task: Task, s: string) => void;
  emptyAction?: React.ReactNode;
  emptyDescription?: string;
}

export default function TaskKanban({
  tasks, users, loading, role, busyTaskId = null,
  onOpen, onConfirmDone, onStatusUp, emptyAction,
  emptyDescription = 'No tasks found. Create your first task to get started!',
}: TaskKanbanProps) {
  const tasksByStatus = Object.fromEntries(
    COLUMNS.map((col) => [col.id, tasks.filter((t) => t.status === col.id)]),
  );

  if (!loading && tasks.length === 0) {
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

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {COLUMNS.map((col) => {
        const colTasks = tasksByStatus[col.id] ?? [];
        return (
          <div
            key={col.id}
            className="flex-shrink-0 w-72 flex flex-col"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
              <span className="text-sm font-semibold text-[var(--text-primary)]">{col.label}</span>
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--surface-2)] text-[var(--text-secondary)]">
                {loading ? '…' : colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1 rounded-xl bg-[var(--surface-2)] p-2 min-h-[400px]">
              {loading
                ? Array.from({ length: 2 }).map((_, i) => <TaskCardSkeleton key={i} />)
                : colTasks.map((task) => (
                    <KanbanCard
                      key={task.taskId}
                      task={task}
                      users={users}
                      role={role}
                      busy={busyTaskId === task.taskId}
                      onOpen={onOpen}
                      onConfirmDone={onConfirmDone}
                      onStatusUp={onStatusUp}
                    />
                  ))
              }
              {!loading && colTasks.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)] py-8">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
