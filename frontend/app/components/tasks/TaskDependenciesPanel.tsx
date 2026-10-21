'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../../lib/api';
import { addTaskDependency, removeTaskDependency, ApiError } from '../../lib/api';
import { StatusBadge } from '../ui/Badge';

interface TaskDependenciesPanelProps {
  task: Task;
  allTasks: Task[];
  /** Base path for task links, e.g. /supervisor/tasks */
  taskBasePath: string;
  isPrivileged: boolean;
  onChanged: () => void;
}

const STATUS_DONE: TaskStatus[] = ['resolved', 'done'];

export default function TaskDependenciesPanel({
  task,
  allTasks,
  taskBasePath,
  isPrivileged,
  onChanged,
}: TaskDependenciesPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickId, setPickId] = useState<number | ''>('');

  const deps = task.dependencies ?? [];
  const dependents = task.dependents ?? [];
  const existingDepIds = useMemo(() => new Set(deps.map((d) => d.taskId)), [deps]);

  const candidates = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          t.taskId !== task.taskId &&
          !existingDepIds.has(t.taskId) &&
          t.status !== 'done',
      ),
    [allTasks, task.taskId, existingDepIds],
  );

  async function handleAdd() {
    if (typeof pickId !== 'number') return;
    setBusy(true);
    setError(null);
    try {
      await addTaskDependency(task.taskId, pickId);
      setPickId('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add dependency');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(dependsOnTaskId: number) {
    setBusy(true);
    setError(null);
    try {
      await removeTaskDependency(task.taskId, dependsOnTaskId);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove dependency');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Dependencies</h3>
        {task.blocked && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Blocked — cannot start
          </span>
        )}
      </div>

      {/* Visual tree: blockers → this task → dependents */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-4 space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Depends on (blockers)
          </p>
          {deps.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No blockers — ready to start when assigned.</p>
          ) : (
            <ul className="space-y-1.5">
              {deps.map((d) => (
                <li key={d.taskId} className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      d.satisfied ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    title={d.satisfied ? 'Satisfied' : 'Blocking'}
                  />
                  <Link
                    href={`${taskBasePath}/${d.taskId}`}
                    className="font-medium text-[var(--accent)] hover:underline truncate"
                  >
                    #{d.taskId} {d.taskTitle}
                  </Link>
                  <StatusBadge status={d.status as TaskStatus} />
                  {isPrivileged && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRemove(d.taskId)}
                      className="ml-auto text-xs text-[var(--text-muted)] hover:text-red-500 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] pl-1">
          <span className="w-px h-4 bg-[var(--border)]" />
          <span>↓</span>
        </div>

        <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-subtle)] px-3 py-2">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
            #{task.taskId} {task.taskTitle}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Current task</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] pl-1">
          <span className="w-px h-4 bg-[var(--border)]" />
          <span>↓</span>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Blocks (dependents)
          </p>
          {dependents.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Nothing waiting on this task.</p>
          ) : (
            <ul className="space-y-1.5">
              {dependents.map((d) => (
                <li key={d.taskId} className="flex items-center gap-2 text-sm">
                  <Link
                    href={`${taskBasePath}/${d.taskId}`}
                    className="font-medium text-[var(--accent)] hover:underline truncate"
                  >
                    #{d.taskId} {d.taskTitle}
                  </Link>
                  <StatusBadge status={d.status as TaskStatus} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isPrivileged && candidates.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Add blocker
            </label>
            <select
              value={pickId === '' ? '' : String(pickId)}
              onChange={(e) => setPickId(e.target.value ? Number(e.target.value) : '')}
              className="w-full h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm px-2"
            >
              <option value="">— Select task —</option>
              {candidates.map((t) => (
                <option key={t.taskId} value={t.taskId}>
                  #{t.taskId} {t.taskTitle}
                  {STATUS_DONE.includes(t.status) ? '' : ` (${t.status})`}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={busy || typeof pickId !== 'number'}
            onClick={() => void handleAdd()}
            className="h-9 px-3 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
