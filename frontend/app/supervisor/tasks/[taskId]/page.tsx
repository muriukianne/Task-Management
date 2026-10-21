'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { decodeToken, getUserRoleFromToken } from '../../../lib/auth';
import {
  getTask, getTasks, getUsers, syncUser, updateTaskStatus, rejectTask, assignTask, ApiError,
  isStaleTaskError, requireTaskVersion, STALE_TASK_MESSAGE,
} from '../../../lib/api';
import type { Task, AppUser, UserRole } from '../../../lib/api';
import { useToast } from '../../../components/providers/ToastContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import TaskDetailView from '../../../components/tasks/TaskDetailView';
import RejectTaskModal from '../../../components/tasks/RejectTaskModal';
import Modal from '../../../components/ui/Modal';
import UserSelect from '../../../components/ui/UserSelect';
import MultiUserSelect from '../../../components/ui/MultiUserSelect';

export default function SupervisorTaskPage() {
  const params = useParams<{ taskId: string }>();
  const taskId = Number(params.taskId);
  const router = useRouter();
  const { toast } = useToast();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser();

  const [callerRole, setCallerRole] = useState<UserRole>('supervisor');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [appUserId, setAppUserId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const [task, setTask] = useState<Task | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reAssignOpen, setReAssignOpen] = useState(false);
  const [reAssignTo, setReAssignTo] = useState<number | ''>('');
  const [reAssignCos, setReAssignCos] = useState<number[]>([]);
  const [reAssigning, setReAssigning] = useState(false);

  useEffect(() => {
    if (!isLoaded || !clerkUserLoaded) return;
    if (!isSignedIn) {
      const t = window.setTimeout(() => router.replace('/login'), 800);
      return () => window.clearTimeout(t);
    }

    async function init() {
      const token = await getToken({ template: 'quarkus' });
      let role: string | null = getUserRoleFromToken(token);
      const profile = {
        email: clerkUser?.primaryEmailAddress?.emailAddress,
        firstName: clerkUser?.firstName ?? undefined,
        lastName: clerkUser?.lastName ?? undefined,
      };
      const clerkName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim()
        || clerkUser?.fullName
        || clerkUser?.primaryEmailAddress?.emailAddress?.split('@')[0]
        || null;
      const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? '';

      try {
        const me = await syncUser(profile);
        role = me.role;
        setAppUserId(me.id);
        const fromDb = [me.firstName, me.lastName].filter(Boolean).join(' ').trim();
        const synthetic = !me.email || me.email.endsWith('@local') || me.firstName === 'User';
        setUserName((!synthetic && fromDb) || clerkName || fromDb || me.email.split('@')[0] || 'Supervisor');
        setUserEmail(me.email && !me.email.endsWith('@local') ? me.email : (clerkEmail || me.email));
      } catch {
        const payload = token ? decodeToken(token) : null;
        setUserName(clerkName ?? payload?.full_name ?? payload?.name ?? 'Supervisor');
        setUserEmail(clerkEmail || payload?.email || '');
      }

      if (role !== 'supervisor' && role !== 'admin') {
        router.replace('/employee');
        return;
      }
      setCallerRole(role as UserRole);
      setReady(true);
    }

    void init();
  }, [isLoaded, isSignedIn, clerkUserLoaded, clerkUser, getToken, router]);

  const load = useCallback(async () => {
    if (!Number.isFinite(taskId) || taskId <= 0) {
      setError('Invalid task id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [t, team, list] = await Promise.all([
        getTask(taskId),
        getUsers(),
        getTasks({ page: 0, size: 100 }),
      ]);
      setTask(t);
      setUsers(team);
      setAllTasks(list.content);
      setReAssignTo(t.assignedTo);
      setReAssignCos(
        (t.assignees ?? [])
          .filter((a) => a.role !== 'LEAD' && a.userId !== t.assignedTo)
          .map((a) => a.userId),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load task');
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function handleStatusUp(t: Task, newStatus: string) {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await updateTaskStatus(t.taskId, newStatus, requireTaskVersion(t));
      setTask(updated);
      toast.success('Status updated', `"${t.taskTitle}" → ${newStatus.replace('_', ' ')}.`);
    } catch (err) {
      if (isStaleTaskError(err)) {
        toast.error('Update conflict', STALE_TASK_MESSAGE);
        await load();
      } else {
        toast.error('Update failed', err instanceof Error ? err.message : 'Could not update status.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDone(t: Task) {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await updateTaskStatus(t.taskId, 'done', requireTaskVersion(t));
      setTask(updated);
      toast.success('Task completed', `"${t.taskTitle}" marked as done.`);
    } catch (err) {
      if (isStaleTaskError(err)) {
        toast.error('Update conflict', STALE_TASK_MESSAGE);
        await load();
      } else {
        toast.error('Failed', err instanceof Error ? err.message : 'Could not confirm task.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(t: Task, reason: string) {
    const updated = await rejectTask(t.taskId, reason);
    setTask(updated);
    toast.success('Task rejected', `"${t.taskTitle}" returned to In Progress.`);
  }

  async function handleReAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!task || typeof reAssignTo !== 'number') return;
    setReAssigning(true);
    try {
      const updated = await assignTask(task.taskId, reAssignTo, reAssignCos);
      setTask(updated);
      setReAssignOpen(false);
      toast.success('Task reassigned', `Team updated for "${task.taskTitle}".`);
    } catch (err) {
      toast.error('Reassign failed', err instanceof Error ? err.message : 'Could not reassign.');
    } finally {
      setReAssigning(false);
    }
  }

  const assignableUsers = users.filter((u) => u.role === 'employee');

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout
      role={callerRole}
      userName={userName}
      userEmail={userEmail}
      pageTitle={task?.taskTitle ?? 'Task'}
      notificationsEnabled={ready}
      onNotificationTask={(id) => router.push(`/supervisor/tasks/${id}`)}
      actions={
        <Link
          href="/supervisor"
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
        >
          ← Back to dashboard
        </Link>
      }
    >
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-6 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Link href="/supervisor" className="inline-block mt-3 text-sm text-[var(--accent)] hover:underline">
            Return to dashboard
          </Link>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          {!loading && task && (
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">{task.taskTitle}</h2>
          )}
          <TaskDetailView
            task={task}
            users={users}
            allTasks={allTasks}
            loading={loading}
            role={callerRole}
            currentUserId={appUserId}
            busy={busy}
            userProfileBase="/supervisor/users"
            taskBasePath="/supervisor/tasks"
            onConfirmDone={(t) => void handleConfirmDone(t)}
            onReject={handleReject}
            onReAssign={(t) => {
              setReAssignTo(t.assignedTo);
              setReAssignCos(
                (t.assignees ?? [])
                  .filter((a) => a.role !== 'LEAD' && a.userId !== t.assignedTo)
                  .map((a) => a.userId),
              );
              setReAssignOpen(true);
            }}
            onStatusUp={(t, s) => void handleStatusUp(t, s)}
            onDocumentsChanged={() => void load()}
            onDependenciesChanged={() => void load()}
          />
        </div>
      )}

      <RejectTaskModal
        task={rejectOpen ? task : null}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={async (t, reason) => {
          await handleReject(t, reason);
          setRejectOpen(false);
        }}
      />

      <Modal
        open={reAssignOpen}
        onClose={() => setReAssignOpen(false)}
        title="Reassign task"
        size="sm"
      >
        <form onSubmit={(e) => void handleReAssign(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Primary lead
            </label>
            <UserSelect
              users={assignableUsers}
              value={reAssignTo}
              onChange={(id) => {
                setReAssignTo(id);
                setReAssignCos((prev) => prev.filter((c) => c !== id));
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Co-assignees
            </label>
            <MultiUserSelect
              users={assignableUsers}
              value={reAssignCos}
              onChange={setReAssignCos}
              excludeIds={typeof reAssignTo === 'number' ? [reAssignTo] : []}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReAssignOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reAssigning || typeof reAssignTo !== 'number'}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-50"
            >
              {reAssigning ? 'Saving…' : 'Save team'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
