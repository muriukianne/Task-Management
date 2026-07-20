'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { decodeToken, getUserRoleFromToken } from '../lib/auth';
import { getTasks, getTask, updateTaskStatus, syncUser } from '../lib/api';
import type { Task, AppUser, TaskStatus } from '../lib/api';
import { useToast } from '../components/providers/ToastContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import TaskFilters from '../components/tasks/TaskFilters';
import TaskTable from '../components/tasks/TaskTable';
import TaskKanban from '../components/tasks/TaskKanban';
import TaskDetail from '../components/tasks/TaskDetail';
import type { SortField, SortDir } from '../components/tasks/TaskFilters';

function StatCard({
  label,
  value,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: number;
  accent?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl border p-4 text-center w-full transition-colors',
        active || accent
          ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50',
      ].join(' ')}
    >
      <p className={`text-2xl font-bold ${active || accent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
        {value}
      </p>
      <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">{label}</p>
    </button>
  );
}

function sortTasks(tasks: Task[], field: SortField, dir: SortDir): Task[] {
  const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const statusOrder: Record<string, number> = {
    created: 1, assigned: 2, in_progress: 3, resolved: 4, done: 5,
  };

  return [...tasks].sort((a, b) => {
    let cmp = 0;

    if (field === 'taskTitle') {
      cmp = (a.taskTitle ?? '').localeCompare(b.taskTitle ?? '', undefined, { sensitivity: 'base' });
    } else if (field === 'priority') {
      cmp = (priorityOrder[a.priority ?? 'medium'] ?? 0) - (priorityOrder[b.priority ?? 'medium'] ?? 0);
    } else if (field === 'status') {
      cmp = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
    } else if (field === 'dueDate' || field === 'createdAt' || field === 'updatedAt') {
      const ta = a[field] ? Date.parse(a[field] as string) : NaN;
      const tb = b[field] ? Date.parse(b[field] as string) : NaN;
      // Null/missing dates always sink to the bottom
      if (!a[field] && !b[field]) return 0;
      if (!a[field]) return 1;
      if (!b[field]) return -1;
      cmp = ta - tb;
    }

    if (cmp === 0) cmp = a.taskId - b.taskId;
    return dir === 'asc' ? cmp : -cmp;
  });
}

function clerkProfile(user: ReturnType<typeof useUser>['user']) {
  if (!user) return {};
  return {
    email:     user.primaryEmailAddress?.emailAddress,
    firstName: user.firstName ?? undefined,
    lastName:  user.lastName ?? undefined,
  };
}

function displayNameFromClerk(user: ReturnType<typeof useUser>['user']): string | null {
  if (!user) return null;
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (user.fullName?.trim()) return user.fullName.trim();
  if (user.username?.trim()) return user.username.trim();
  const email = user.primaryEmailAddress?.emailAddress;
  if (email) return email.split('@')[0];
  return null;
}

export default function EmployeePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser();

  const [tasks, setTasks]         = useState<Task[]>([]);
  const [loading, setLoading]     = useState(true);
  const [userName, setUserName]   = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [appUserId, setAppUserId] = useState<number | null>(null);
  const [ready, setReady]         = useState(false);

  const [statusFilter, setStatusFilter]     = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortField, setSortField]           = useState<SortField>('updatedAt');
  const [sortDir, setSortDir]               = useState<SortDir>('desc');
  const [viewMode, setViewMode]             = useState<'table' | 'kanban'>('table');

  const [detailOpen, setDetailOpen]       = useState(false);
  const [detailTask, setDetailTask]       = useState<Task | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyTaskId, setBusyTaskId]       = useState<number | null>(null);

  useEffect(() => {
    if (!isLoaded || !clerkUserLoaded) return;
    if (!isSignedIn) {
      const t = window.setTimeout(() => {
        router.replace('/login');
      }, 800);
      return () => window.clearTimeout(t);
    }

    async function init() {
      const token = await getToken({ template: 'quarkus' });
      let role: string | null = getUserRoleFromToken(token);
      const profile = clerkProfile(clerkUser);
      const clerkName = displayNameFromClerk(clerkUser);
      const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? '';

      try {
        const me = await syncUser(profile);
        role = me.role;
        const fromDb = [me.firstName, me.lastName].filter(Boolean).join(' ').trim();
        const synthetic = !me.email || me.email.endsWith('@local') || me.firstName === 'User';
        setUserName(
          (!synthetic && fromDb) || clerkName || fromDb || me.email.split('@')[0] || 'Me',
        );
        setUserEmail(
          me.email && !me.email.endsWith('@local') ? me.email : (clerkEmail || me.email),
        );
        setFirstName(me.firstName || clerkUser?.firstName || '');
        setLastName(me.lastName || clerkUser?.lastName || '');
        setAppUserId(me.id);
      } catch {
        const payload = token ? decodeToken(token) : null;
        setUserName(
          clerkName
            ?? payload?.full_name
            ?? payload?.name
            ?? payload?.user_metadata?.full_name
            ?? payload?.email?.split('@')[0]
            ?? 'Me',
        );
        setUserEmail(
          clerkEmail || payload?.email || payload?.user_metadata?.email || '',
        );
        setFirstName(clerkUser?.firstName ?? '');
        setLastName(clerkUser?.lastName ?? '');
        setAppUserId(null);
      }

      if (role === 'supervisor' || role === 'admin') {
        router.replace('/supervisor');
        return;
      }

      setReady(true);
    }

    void init();
  }, [isLoaded, isSignedIn, clerkUserLoaded, clerkUser, getToken, router]);

  useEffect(() => {
    if (!ready) return;
    void fetchTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTasks({ size: 100 });
      setTasks(result.content);
    } catch (err: unknown) {
      toast.error('Load failed', err instanceof Error ? err.message : 'Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  async function handleOpenDetail(task: Task) {
    setDetailTask(task);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const fresh = await getTask(task.taskId);
      setDetailTask(fresh);
    } catch (err: unknown) {
      toast.error(
        'Could not open task',
        err instanceof Error ? err.message : 'Task details unavailable.',
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleStatusUp(task: Task, newStatus: string) {
    if (busyTaskId != null) return;

    const previous = task;
    const optimistic = { ...task, status: newStatus as TaskStatus };

    setBusyTaskId(task.taskId);
    setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? optimistic : t)));
    setDetailTask((curr) => (curr?.taskId === task.taskId ? optimistic : curr));

    try {
      const updated = await updateTaskStatus(task.taskId, newStatus);
      const label = newStatus === 'in_progress' ? 'in progress' : newStatus.replace('_', ' ');
      toast.success('Status updated', `"${task.taskTitle}" is now ${label}.`);
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? updated : t)));
      setDetailTask((curr) => (curr?.taskId === task.taskId ? updated : curr));
    } catch (err: unknown) {
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? previous : t)));
      setDetailTask((curr) => (curr?.taskId === task.taskId ? previous : curr));
      toast.error('Update failed', err instanceof Error ? err.message : 'Could not update status.');
    } finally {
      setBusyTaskId(null);
    }
  }

  const counts = {
    total:      tasks.length,
    assigned:   tasks.filter((t) => t.status === 'assigned').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    // Employees finish work as "resolved"; supervisor then marks "done".
    // Both count as completed from the employee view.
    completed:  tasks.filter((t) => t.status === 'resolved' || t.status === 'done').length,
  };

  const filtered = tasks.filter((t) => {
    if (statusFilter === 'completed') {
      if (t.status !== 'resolved' && t.status !== 'done') return false;
    } else if (statusFilter !== 'all' && t.status !== statusFilter) {
      return false;
    }
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });
  const sorted = sortTasks(filtered, sortField, sortDir);

  const selfUser: AppUser[] = appUserId != null
    ? [{
        id:        appUserId,
        clerkId:   null,
        email:     userEmail,
        firstName: firstName || userName.split(' ')[0] || userName,
        lastName:  lastName || userName.split(' ').slice(1).join(' ') || '',
        role:      'employee',
      }]
    : [];

  if (!ready) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">Loading your tasks…</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      role="employee"
      userName={userName || 'Me'}
      userEmail={userEmail}
      pageTitle="My Tasks"
    >
      <div className="space-y-6">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total"
            value={counts.total}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <StatCard
            label="Assigned"
            value={counts.assigned}
            accent={counts.assigned > 0 && statusFilter !== 'assigned'}
            active={statusFilter === 'assigned'}
            onClick={() => setStatusFilter('assigned')}
          />
          <StatCard
            label="In Progress"
            value={counts.inProgress}
            active={statusFilter === 'in_progress'}
            onClick={() => setStatusFilter('in_progress')}
          />
          <StatCard
            label="Completed"
            value={counts.completed}
            accent={counts.completed > 0 && statusFilter !== 'completed'}
            active={statusFilter === 'completed'}
            onClick={() => setStatusFilter('completed')}
          />
        </div>

        {counts.assigned > 0 && statusFilter !== 'assigned' && (
          <button
            type="button"
            onClick={() => setStatusFilter('assigned')}
            className="flex items-center gap-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 w-full text-left hover:border-blue-400 transition-colors"
          >
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
              You have <strong>{counts.assigned}</strong> task{counts.assigned > 1 ? 's' : ''} ready to start.
            </p>
          </button>
        )}

        <TaskFilters
          status={statusFilter}
          priority={priorityFilter}
          sortField={sortField}
          sortDir={sortDir}
          viewMode={viewMode}
          role="employee"
          onStatus={setStatusFilter}
          onPriority={setPriorityFilter}
          onSort={(f, d) => { setSortField(f); setSortDir(d); }}
          onViewMode={setViewMode}
        />

        {viewMode === 'table' ? (
          <TaskTable
            tasks={sorted}
            users={selfUser}
            loading={loading}
            sortField={sortField}
            sortDir={sortDir}
            role="employee"
            busyTaskId={busyTaskId}
            onSort={(f, d) => { setSortField(f); setSortDir(d); }}
            onRowClick={handleOpenDetail}
            onConfirmDone={() => {}}
            onReAssign={() => {}}
            onStatusUp={handleStatusUp}
            emptyDescription="No tasks match these filters. Try All, or wait for your supervisor to assign work."
          />
        ) : (
          <TaskKanban
            tasks={sorted}
            users={selfUser}
            loading={loading}
            role="employee"
            busyTaskId={busyTaskId}
            onOpen={handleOpenDetail}
            onConfirmDone={() => {}}
            onStatusUp={handleStatusUp}
            emptyDescription="No tasks match these filters. Try All, or wait for your supervisor to assign work."
          />
        )}

        <TaskDetail
          task={detailTask}
          users={selfUser}
          loading={detailLoading}
          role="employee"
          open={detailOpen}
          busy={busyTaskId != null && detailTask?.taskId === busyTaskId}
          onClose={() => setDetailOpen(false)}
          onConfirmDone={() => {}}
          onReAssign={() => {}}
          onStatusUp={handleStatusUp}
        />
      </div>
    </DashboardLayout>
  );
}
