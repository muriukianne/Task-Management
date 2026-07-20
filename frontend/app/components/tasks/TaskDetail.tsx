'use client';

import type { Task, AppUser } from '../../lib/api';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import Modal from '../ui/Modal';
import { Skeleton } from '../ui/Skeleton';

interface TaskDetailProps {
  task:     Task | null;
  users:    AppUser[];
  loading:  boolean;
  role:     string;
  open:     boolean;
  busy?:    boolean;
  onClose:  () => void;
  onConfirmDone: (task: Task) => void;
  onReAssign:    (task: Task) => void;
  onStatusUp:    (task: Task, status: string) => void;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function displayUser(users: AppUser[], id: number | undefined, fallback: string) {
  if (id == null) return '—';
  const u = users.find((x) => x.id === id);
  if (u) return `${u.firstName} ${u.lastName}`.trim() || u.email;
  return fallback;
}

export default function TaskDetail({
  task, users, loading, role, open, busy = false,
  onClose, onConfirmDone, onReAssign, onStatusUp,
}: TaskDetailProps) {
  const assigneeName = displayUser(
    users,
    task?.assignedTo,
    role === 'employee' ? 'You' : (task ? `#${task.assignedTo}` : '—'),
  );
  const assignerName = displayUser(
    users,
    task?.assignedBy,
    role === 'employee' ? 'Supervisor' : (task ? `#${task.assignedBy}` : '—'),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task?.taskTitle ?? 'Task Details'}
      size="md"
    >
      {loading || !task ? (
        <div className="space-y-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority ?? 'medium'} />
            {task.attachedFile && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                📎 {task.attachedFile.split('_').slice(2).join('_') || task.attachedFile}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3">
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
              {task.taskDescription || 'No description provided.'}
            </p>
          </div>

          {/* Meta grid */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Task ID"     value={`#${task.taskId}`} />
            <InfoRow label="Assigned to" value={assigneeName} />
            <InfoRow label="Assigned by" value={assignerName} />
            <InfoRow label="Due date"    value={
              task.dueDate
                ? <span className={new Date(task.dueDate) < new Date() ? 'text-red-500 font-semibold' : ''}>
                    {fmt(task.dueDate)}
                  </span>
                : '—'
            } />
            <InfoRow label="Created"      value={fmt(task.createdAt)} />
            <InfoRow label="Last updated" value={fmt(task.updatedAt)} />
          </dl>

          {/* Action buttons — stay open after status change so employee can Start → Resolve */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
            {(role === 'supervisor' || role === 'admin') && task.status === 'resolved' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => { onConfirmDone(task); onClose(); }}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {busy ? 'Updating…' : 'Confirm Done'}
              </button>
            )}
            {(role === 'supervisor' || role === 'admin') &&
             (task.status === 'created' || task.status === 'assigned') && (
              <button
                type="button"
                onClick={() => { onReAssign(task); onClose(); }}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-sm font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                Reassign
              </button>
            )}
            {role === 'employee' && task.status === 'assigned' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatusUp(task, 'in_progress')}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {busy ? 'Updating…' : 'Start Working'}
              </button>
            )}
            {role === 'employee' && task.status === 'in_progress' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStatusUp(task, 'resolved')}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {busy ? 'Updating…' : 'Mark as Resolved'}
              </button>
            )}
            {task.status === 'resolved' && role === 'employee' && (
              <p className="text-sm text-[var(--text-secondary)] italic py-2">
                Awaiting supervisor confirmation.
              </p>
            )}
            {task.status === 'done' && (
              <span className="px-4 py-2 rounded-xl bg-[var(--success-subtle)] text-[var(--success)] text-sm font-semibold">
                ✓ Completed
              </span>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
