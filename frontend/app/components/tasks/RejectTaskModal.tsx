'use client';

import { useState } from 'react';
import type { Task } from '../../lib/api';
import Modal from '../ui/Modal';

interface RejectTaskModalProps {
  task: Task | null;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (task: Task, reason: string) => Promise<void> | void;
}

export default function RejectTaskModal({
  task, open, busy = false, onClose, onConfirm,
}: RejectTaskModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!task) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('Please provide at least 3 characters explaining the rejection.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(task, trimmed);
      setReason('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting || busy) return;
    setReason('');
    setError('');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Reject task"
      description={task ? `Return “${task.taskTitle}” to In Progress with feedback for the assignee.` : undefined}
      size="md"
    >
      <div className="space-y-3">
        <label className="block text-sm text-[var(--text-secondary)]">
          Reason <span className="text-red-500">*</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="What needs to be fixed or improved?"
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-orange-400/40"
          />
        </label>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={submitting || busy}
            onClick={handleClose}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || busy || reason.trim().length < 3}
            onClick={() => void handleSubmit()}
            className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting || busy ? 'Rejecting…' : 'Reject & reopen'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
