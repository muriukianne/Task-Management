'use client';

import type { Task, AppUser } from '../../lib/api';
import Modal from '../ui/Modal';
import TaskDetailView from './TaskDetailView';

interface TaskDetailProps {
  task: Task | null;
  users: AppUser[];
  loading: boolean;
  role: string;
  currentUserId?: number | null;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirmDone: (task: Task) => void;
  onReject?: (task: Task, reason: string) => Promise<void> | void;
  onReAssign: (task: Task) => void;
  onStatusUp: (task: Task, status: string) => void;
}

/** Modal shell around {@link TaskDetailView} for quick peek from list pages. */
export default function TaskDetail({
  task, users, loading, role, currentUserId = null, open, busy = false,
  onClose, onConfirmDone, onReject, onReAssign, onStatusUp,
}: TaskDetailProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task?.taskTitle ?? 'Task Details'}
      size="lg"
    >
      <TaskDetailView
        task={task}
        users={users}
        loading={loading}
        role={role}
        currentUserId={currentUserId}
        active={open}
        busy={busy}
        onConfirmDone={onConfirmDone}
        onReject={onReject}
        onReAssign={onReAssign}
        onStatusUp={onStatusUp}
        onAfterReject={onClose}
        onAfterConfirmDone={onClose}
      />
    </Modal>
  );
}
