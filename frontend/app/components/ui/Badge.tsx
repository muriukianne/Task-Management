import type { Priority, TaskStatus, UserRole } from '../../lib/api';

// ── Status ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<TaskStatus, { label: string; cls: string }> = {
  created:     { label: 'Created',     cls: 'bg-slate-100   text-slate-700   dark:bg-slate-800  dark:text-slate-300' },
  assigned:    { label: 'Assigned',    cls: 'bg-blue-100    text-blue-700    dark:bg-blue-900/40 dark:text-blue-300' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100   text-amber-700   dark:bg-amber-900/40 dark:text-amber-300' },
  resolved:    { label: 'Resolved',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  done:        { label: 'Done',        cls: 'bg-violet-100  text-violet-700  dark:bg-violet-900/40 dark:text-violet-300' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as TaskStatus] ?? { label: status, cls: 'bg-slate-100 text-slate-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Priority ──────────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<Priority, { label: string; cls: string; dot: string }> = {
  low: {
    label: 'Low',
    cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-300/40 dark:bg-slate-800/80 dark:text-slate-400 dark:ring-slate-600/40',
    dot: 'bg-slate-400',
  },
  medium: {
    label: 'Medium',
    cls: 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300/50 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-700/40',
    dot: 'bg-indigo-500',
  },
  high: {
    label: 'High',
    cls: 'bg-amber-100 text-amber-800 ring-1 ring-amber-400/50 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-600/40',
    dot: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.55)]',
  },
  critical: {
    label: 'Critical',
    cls: 'bg-red-100 text-red-800 ring-1 ring-red-400/60 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-500/50 shadow-[0_0_10px_rgba(220,38,38,0.18)]',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse',
  },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CFG[priority as Priority] ?? PRIORITY_CFG.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Role ──────────────────────────────────────────────────────────────────────

const ROLE_CFG: Record<UserRole, { cls: string }> = {
  admin:      { cls: 'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-300' },
  supervisor: { cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  employee:   { cls: 'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300' },
};

export function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CFG[role as UserRole] ?? { cls: 'bg-slate-100 text-slate-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${cfg.cls}`}>
      {role}
    </span>
  );
}
