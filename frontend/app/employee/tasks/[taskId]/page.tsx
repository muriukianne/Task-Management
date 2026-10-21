'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { decodeToken, getUserRoleFromToken } from '../../../lib/auth';
import {
  getTask, getTasks, syncUser, updateTaskStatus, ApiError,
  isStaleTaskError, requireTaskVersion, STALE_TASK_MESSAGE,
} from '../../../lib/api';
import type { Task, AppUser, TaskStatus } from '../../../lib/api';
import { useToast } from '../../../components/providers/ToastContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import TaskDetailView from '../../../components/tasks/TaskDetailView';

export default function EmployeeTaskPage() {
  const params = useParams<{ taskId: string }>();
  const taskId = Number(params.taskId);
  const router = useRouter();
  const { toast } = useToast();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [appUserId, setAppUserId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const [task, setTask] = useState<Task | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
        setUserName((!synthetic && fromDb) || clerkName || fromDb || me.email.split('@')[0] || 'Me');
        setUserEmail(me.email && !me.email.endsWith('@local') ? me.email : (clerkEmail || me.email));
      } catch {
        const payload = token ? decodeToken(token) : null;
        setUserName(clerkName ?? payload?.full_name ?? 'Me');
        setUserEmail(clerkEmail || payload?.email || '');
      }

      if (role === 'supervisor' || role === 'admin') {
        router.replace(`/supervisor/tasks/${taskId}`);
        return;
      }
      setReady(true);
    }

    void init();
  }, [isLoaded, isSignedIn, clerkUserLoaded, clerkUser, getToken, router, taskId]);

  const load = useCallback(async () => {
    if (!Number.isFinite(taskId) || taskId <= 0) {
      setError('Invalid task id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [t, list] = await Promise.all([
        getTask(taskId),
        getTasks({ page: 0, size: 100 }),
      ]);
      setTask(t);
      setAllTasks(list.content);
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

  const selfUser: AppUser[] = appUserId != null && task
    ? [{
        id: appUserId,
        clerkId: null,
        email: userEmail,
        firstName: userName.split(' ')[0] || 'You',
        lastName: userName.split(' ').slice(1).join(' ') || '',
        role: 'employee',
      }]
    : [];

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout
      role="employee"
      userName={userName || 'Me'}
      userEmail={userEmail}
      pageTitle={task?.taskTitle ?? 'Task'}
      notificationsEnabled={ready}
      onNotificationTask={(id) => router.push(`/employee/tasks/${id}`)}
      actions={
        <Link
          href="/employee"
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
        >
          ← Back to my tasks
        </Link>
      }
    >
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-6 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Link href="/employee" className="inline-block mt-3 text-sm text-[var(--accent)] hover:underline">
            Return to my tasks
          </Link>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          {!loading && task && (
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">{task.taskTitle}</h2>
          )}
          <TaskDetailView
            task={task}
            users={selfUser}
            allTasks={allTasks}
            loading={loading}
            role="employee"
            currentUserId={appUserId}
            busy={busy}
            taskBasePath="/employee/tasks"
            onConfirmDone={() => {}}
            onReAssign={() => {}}
            onStatusUp={(t, s) => void handleStatusUp(t, s as TaskStatus)}
            onDocumentsChanged={() => void load()}
            onDependenciesChanged={() => void load()}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
