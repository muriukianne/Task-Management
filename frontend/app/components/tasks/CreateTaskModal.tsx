'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { AppUser, Task } from '../../lib/api';
import Modal from '../ui/Modal';
import UserSelect from '../ui/UserSelect';
import MultiUserSelect from '../ui/MultiUserSelect';

interface CreateTaskModalProps {
  open:    boolean;
  users:   AppUser[];
  /** Existing tasks for dependency picker (optional). */
  tasks?:  Task[];
  onClose: () => void;
  onSubmit: (data: {
    taskTitle:       string;
    taskDescription: string;
    assignedTo:      number;
    coAssignees?:    number[];
    dependsOnTaskIds?: number[];
    priority:        string;
    dueDate?:        string;
  }) => Promise<void>;
}

const INPUT = [
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)]',
  'px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
  'transition-shadow',
].join(' ');

const LABEL = 'block text-sm font-medium text-[var(--text-primary)] mb-1.5';

export default function CreateTaskModal({
  open, users, tasks = [], onClose, onSubmit,
}: CreateTaskModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [assignedTo, setAssignedTo] = useState<number | ''>('');
  const [coAssignees, setCoAssignees] = useState<number[]>([]);
  const [dependsOn, setDependsOn] = useState<number[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  const dependencyOptions = useMemo(
    () => tasks.filter((t) => t.status !== 'done'),
    [tasks],
  );

  useEffect(() => {
    if (!open) {
      setAssignedTo('');
      setCoAssignees([]);
      setDependsOn([]);
      formRef.current?.reset();
    }
  }, [open]);

  useEffect(() => {
    if (typeof assignedTo === 'number') {
      setCoAssignees((prev) => prev.filter((id) => id !== assignedTo));
    }
  }, [assignedTo]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formRef.current || typeof assignedTo !== 'number') return;
    const fd = new FormData(formRef.current);

    const data = {
      taskTitle:       (fd.get('title') as string).trim(),
      taskDescription: (fd.get('desc')  as string).trim(),
      assignedTo,
      coAssignees:     coAssignees.length ? coAssignees : undefined,
      dependsOnTaskIds: dependsOn.length ? dependsOn : undefined,
      priority:        fd.get('priority') as string,
      dueDate:         (fd.get('dueDate') as string) || undefined,
    };

    setSubmitting(true);
    try {
      await onSubmit(data);
      formRef.current?.reset();
      setAssignedTo('');
      setCoAssignees([]);
      setDependsOn([]);
      onClose();
    } catch {
      // Parent shows toast; keep the form open for correction.
    } finally {
      setSubmitting(false);
    }
  }

  function toggleDependency(taskId: number) {
    setDependsOn((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New Task" description="Assign a lead, optional co-assignees, and dependencies.">
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">

        <div>
          <label htmlFor="ct-title" className={LABEL}>Task Title <span className="text-red-500">*</span></label>
          <input
            id="ct-title" name="title" required minLength={3} maxLength={200}
            placeholder="e.g. Design onboarding flow screens"
            className={INPUT}
          />
        </div>

        <div>
          <label htmlFor="ct-desc" className={LABEL}>Description <span className="text-red-500">*</span></label>
          <textarea
            id="ct-desc" name="desc" required minLength={10} maxLength={5000}
            rows={4}
            placeholder="Describe what needs to be done, acceptance criteria, notes…"
            className={`${INPUT} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ct-assign" className={LABEL}>Primary lead <span className="text-red-500">*</span></label>
            <UserSelect
              id="ct-assign"
              users={users}
              value={assignedTo}
              onChange={setAssignedTo}
              required
              emptyHint="Create an employee under Team → New Account first."
            />
          </div>
          <div>
            <label htmlFor="ct-priority" className={LABEL}>Priority</label>
            <select id="ct-priority" name="priority" defaultValue="medium" className={INPUT}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL}>
            Co-assignees <span className="text-[var(--text-muted)] font-normal text-xs">(optional)</span>
          </label>
          <MultiUserSelect
            users={users}
            value={coAssignees}
            onChange={setCoAssignees}
            excludeIds={typeof assignedTo === 'number' ? [assignedTo] : []}
            placeholder="Add supporting teammates…"
          />
        </div>

        <div>
          <label htmlFor="ct-due" className={LABEL}>Due Date <span className="text-[var(--text-muted)] font-normal text-xs">(optional)</span></label>
          <input
            id="ct-due" name="dueDate" type="date"
            min={new Date().toISOString().split('T')[0]}
            className={INPUT}
          />
        </div>

        {dependencyOptions.length > 0 && (
          <div>
            <label className={LABEL}>
              Depends on <span className="text-[var(--text-muted)] font-normal text-xs">(optional — blocks Start until resolved)</span>
            </label>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
              {dependencyOptions.map((t) => {
                const checked = dependsOn.includes(t.taskId);
                return (
                  <label
                    key={t.taskId}
                    className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-[var(--surface-2)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDependency(t.taskId)}
                      className="mt-1 accent-[var(--accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--text-primary)] truncate">
                        #{t.taskId} {t.taskTitle}
                      </span>
                      <span className="block text-xs text-[var(--text-muted)] capitalize">
                        {t.status.replace('_', ' ')}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={submitting || !assignedTo}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="32" strokeLinecap="round"/>
              </svg>
            )}
            {submitting ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
