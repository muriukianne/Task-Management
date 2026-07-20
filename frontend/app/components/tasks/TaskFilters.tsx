'use client';

import type { Priority, TaskStatus } from '../../lib/api';

export type SortField = 'taskTitle' | 'createdAt' | 'updatedAt' | 'priority' | 'dueDate' | 'status';
export type SortDir   = 'asc' | 'desc';

interface TaskFiltersProps {
  status:         string;
  priority:       string;
  sortField:      SortField;
  sortDir:        SortDir;
  viewMode:       'table' | 'kanban';
  /** When 'employee', hides statuses they never hold (e.g. Created). */
  role?:          string;
  onStatus:       (v: string) => void;
  onPriority:     (v: string) => void;
  onSort:         (field: SortField, dir: SortDir) => void;
  onViewMode:     (v: 'table' | 'kanban') => void;
}

const STATUSES: { value: TaskStatus | 'all'; label: string; employee?: boolean }[] = [
  { value: 'all',         label: 'All',         employee: true },
  { value: 'created',     label: 'Created' },
  { value: 'assigned',    label: 'Assigned',    employee: true },
  { value: 'in_progress', label: 'In Progress', employee: true },
  { value: 'resolved',    label: 'Resolved',    employee: true },
  { value: 'done',        label: 'Done',        employee: true },
];

const PRIORITIES: { value: Priority | 'all'; label: string }[] = [
  { value: 'all',      label: 'All priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high',     label: 'High' },
  { value: 'medium',   label: 'Medium' },
  { value: 'low',      label: 'Low' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'taskTitle', label: 'Title' },
  { value: 'createdAt', label: 'Date created' },
  { value: 'updatedAt', label: 'Last updated' },
  { value: 'dueDate',   label: 'Due date' },
  { value: 'priority',  label: 'Priority' },
  { value: 'status',    label: 'Status' },
];

export default function TaskFilters({
  status, priority, sortField, sortDir,
  viewMode, role, onStatus, onPriority, onSort, onViewMode,
}: TaskFiltersProps) {
  const statuses = role === 'employee'
    ? STATUSES.filter((s) => s.employee)
    : STATUSES;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {statuses.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onStatus(value)}
            className={[
              'px-3 py-1 rounded-full text-xs font-semibold transition-colors border',
              status === value
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {/* Priority filter */}
        <select
          value={priority}
          onChange={(e) => onPriority(e.target.value)}
          className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-xs px-2 pr-6 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        >
          {PRIORITIES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <select
            value={sortField}
            onChange={(e) => onSort(e.target.value as SortField, sortDir)}
            className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-xs px-2 pr-6 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            onClick={() => onSort(sortField, sortDir === 'asc' ? 'desc' : 'asc')}
            aria-label={`Sort ${sortDir === 'asc' ? 'descending' : 'ascending'}`}
            className="h-8 w-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              {sortDir === 'asc'
                ? <path d="M2 9l4-6 4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                : <path d="M2 3l4 6 4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              }
            </svg>
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface)]">
          {(['table', 'kanban'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onViewMode(mode)}
              aria-label={mode === 'table' ? 'Table view' : 'Kanban view'}
              className={[
                'h-8 w-8 flex items-center justify-center text-xs transition-colors',
                viewMode === mode
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {mode === 'table'
                ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="11" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="5.25" width="11" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="9.5" width="11" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
                : <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="3" height="11" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="5" y="1" width="3" height="8"  rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="9" y="1" width="3" height="6"  rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
              }
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
