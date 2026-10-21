'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { decodeToken, getUserRoleFromToken } from '../lib/auth';
import {
  getTask, getTasks, getUsers, createTask, assignTask,
  updateTaskStatus, rejectTask, createUser, updateUser, deleteUser, syncUser, ApiError,
  isStaleTaskError, requireTaskVersion, STALE_TASK_MESSAGE,
} from '../lib/api';
import type { Task, AppUser, UserRole, TaskStatus } from '../lib/api';
import { useToast } from '../components/providers/ToastContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import TaskFilters from '../components/tasks/TaskFilters';
import TaskTable from '../components/tasks/TaskTable';
import TaskKanban from '../components/tasks/TaskKanban';
import RejectTaskModal from '../components/tasks/RejectTaskModal';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import CreateUserModal from '../components/users/CreateUserModal';
import EditUserModal from '../components/users/EditUserModal';
import UserTable from '../components/users/UserTable';
import Modal from '../components/ui/Modal';
import UserSelect from '../components/ui/UserSelect';
import MultiUserSelect from '../components/ui/MultiUserSelect';
import type { SortField, SortDir } from '../components/tasks/TaskFilters';
import { getDueUrgency } from '../lib/dueDate';

type Tab = 'tasks' | 'users';

function StatCard({
  label, value, active, onClick,
}: {
  label: string; value: number; active?: boolean; onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      onClick={onClick}
      className={[
        'rounded-xl border p-4 text-center transition-all',
        onClick ? 'cursor-pointer' : '',
        active
          ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50',
      ].join(' ')}
    >
      <p className={`text-2xl font-bold ${active ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
        {value}
      </p>
      <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">{label}</p>
    </div>
  );
}

function sortTasks(tasks: Task[], field: SortField, dir: SortDir): Task[] {
  return [...tasks].sort((a, b) => {
    let va: string | number = (a[field as keyof Task] as string) ?? '';
    let vb: string | number = (b[field as keyof Task] as string) ?? '';
    if (field === 'priority') {
      const order: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      va = order[a.priority ?? 'medium'] ?? 0;
      vb = order[b.priority ?? 'medium'] ?? 0;
    }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

export default function SupervisorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser();

  const [callerRole, setCallerRole]   = useState<UserRole>('supervisor');
  const [userName, setUserName]       = useState('');
  const [userEmail, setUserEmail]     = useState('');
  const [ready, setReady]             = useState(false);

  const [tasks, setTasks]             = useState<Task[]>([]);
  const [users, setUsers]             = useState<AppUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);

  const [tab, setTab] = useState<Tab>('tasks');

  const [statusFilter, setStatusFilter]     = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dueFilter, setDueFilter]           = useState('all');
  const [sortField, setSortField]           = useState<SortField>('updatedAt');
  const [sortDir, setSortDir]               = useState<SortDir>('desc');
  const [viewMode, setViewMode]             = useState<'table' | 'kanban'>('table');

  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editUser, setEditUser]             = useState<AppUser | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser]     = useState(false);

  const [reAssignTask, setReAssignTask] = useState<Task | null>(null);
  const [reAssignTo, setReAssignTo]     = useState<number | ''>('');
  const [reAssignCos, setReAssignCos]   = useState<number[]>([]);
  const [reAssigning, setReAssigning]   = useState(false);
  const [rejectTaskTarget, setRejectTaskTarget] = useState<Task | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

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
      const profile = {
        email:     clerkUser?.primaryEmailAddress?.emailAddress,
        firstName: clerkUser?.firstName ?? undefined,
        lastName:  clerkUser?.lastName ?? undefined,
      };
      const clerkName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim()
        || clerkUser?.fullName
        || clerkUser?.primaryEmailAddress?.emailAddress?.split('@')[0]
        || null;
      const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? '';

      try {
        const me = await syncUser(profile);
        role = me.role;
        const fromDb = [me.firstName, me.lastName].filter(Boolean).join(' ').trim();
        const synthetic = !me.email || me.email.endsWith('@local') || me.firstName === 'User';
        setUserName(
          (!synthetic && fromDb) || clerkName || fromDb || me.email.split('@')[0] || 'Supervisor',
        );
        setUserEmail(
          me.email && !me.email.endsWith('@local') ? me.email : (clerkEmail || me.email),
        );
      } catch {
        const payload = token ? decodeToken(token) : null;
        setUserName(
          clerkName
            ?? payload?.full_name
            ?? payload?.name
            ?? payload?.user_metadata?.full_name
            ?? payload?.email?.split('@')[0]
            ?? 'Supervisor',
        );
        setUserEmail(clerkEmail || payload?.email || payload?.user_metadata?.email || '');
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

  useEffect(() => {
    if (!ready) return;
    void fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setUsersLoading(true);
    const errors: string[] = [];

    const [taskOutcome, userOutcome] = await Promise.allSettled([
      getTasks({ size: 100 }),
      getUsers(),
    ]);

    if (taskOutcome.status === 'fulfilled') {
      setTasks(taskOutcome.value.content);
    } else {
      const err = taskOutcome.reason;
      errors.push(err instanceof Error ? err.message : 'Could not load tasks.');
    }

    if (userOutcome.status === 'fulfilled') {
      setUsers(userOutcome.value);
    } else {
      const err = userOutcome.reason;
      errors.push(err instanceof Error ? err.message : 'Could not load team.');
    }

    setLoading(false);
    setUsersLoading(false);

    if (errors.length) {
      toast.error('Load failed', errors.join(' '));
    }
  }, [toast]);

  async function refreshTaskInList(taskId: number) {
    try {
      const fresh = await getTask(taskId);
      setTasks((prev) => prev.map((t) => (t.taskId === taskId ? fresh : t)));
    } catch {
      await fetchAll();
    }
  }

  async function handleStatusUp(task: Task, newStatus: string) {
    if (busyTaskId != null) return;

    const previous = task;
    const optimistic = { ...task, status: newStatus as TaskStatus };

    setBusyTaskId(task.taskId);
    setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? optimistic : t)));

    try {
      const updated = await updateTaskStatus(task.taskId, newStatus, requireTaskVersion(task));
      toast.success('Status updated', `"${task.taskTitle}" → ${newStatus.replace('_', ' ')}.`);
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? updated : t)));
    } catch (err: unknown) {
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? previous : t)));
      if (isStaleTaskError(err)) {
        toast.error('Update conflict', STALE_TASK_MESSAGE);
        await refreshTaskInList(task.taskId);
      } else {
        toast.error('Update failed', err instanceof Error ? err.message : 'Could not update status.');
      }
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleConfirmDone(task: Task) {
    if (busyTaskId != null) return;

    const previous = task;
    const optimistic = { ...task, status: 'done' as TaskStatus };

    setBusyTaskId(task.taskId);
    setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? optimistic : t)));

    try {
      const updated = await updateTaskStatus(task.taskId, 'done', requireTaskVersion(task));
      toast.success('Task completed', `"${task.taskTitle}" marked as done.`);
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? updated : t)));
    } catch (err: unknown) {
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? previous : t)));
      if (isStaleTaskError(err)) {
        toast.error('Update conflict', STALE_TASK_MESSAGE);
        await refreshTaskInList(task.taskId);
      } else {
        toast.error('Failed', err instanceof Error ? err.message : 'Could not confirm task.');
      }
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleRejectTask(task: Task, reason: string) {
    setRejecting(true);
    try {
      const updated = await rejectTask(task.taskId, reason);
      toast.success('Task rejected', `"${task.taskTitle}" returned to In Progress.`);
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? updated : t)));
      setRejectTaskTarget(null);
    } catch (err: unknown) {
      const message = err instanceof ApiError
        ? err.message
        : (err instanceof Error ? err.message : 'Could not reject task.');
      toast.error('Reject failed', message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setRejecting(false);
    }
  }

  async function handleCreateTask(data: {
    taskTitle: string;
    taskDescription: string;
    assignedTo: number;
    coAssignees?: number[];
    dependsOnTaskIds?: number[];
    priority: string;
    dueDate?: string;
  }) {
    const created = await createTask(data);
    toast.success('Task created', `"${created.taskTitle}" has been assigned.`);
    setTasks((prev) => [created, ...prev]);
  }

  async function handleReAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!reAssignTask || typeof reAssignTo !== 'number') return;
    setReAssigning(true);
    try {
      const updated = await assignTask(reAssignTask.taskId, reAssignTo, reAssignCos);
      const member  = users.find((u) => u.id === reAssignTo);
      const coLabel = reAssignCos.length ? ` (+${reAssignCos.length} co)` : '';
      toast.success(
        'Task reassigned',
        `Lead: ${member ? `${member.firstName} ${member.lastName}` : `#${reAssignTo}`}${coLabel}.`,
      );
      setTasks((prev) => prev.map((t) => (t.taskId === reAssignTask.taskId ? updated : t)));
      setReAssignTask(null);
    } catch (err: unknown) {
      toast.error('Reassign failed', err instanceof Error ? err.message : 'Could not reassign task.');
    } finally {
      setReAssigning(false);
    }
  }

  async function handleCreateUser(data: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  }) {
    try {
      await createUser(data);
      toast.success('Account created', `${data.role} account for ${data.email} is ready.`);
      const fresh = await getUsers();
      setUsers(fresh);
    } catch (err: unknown) {
      const detail = err instanceof ApiError && err.errors?.length
        ? err.errors.join('; ')
        : err instanceof Error ? err.message : 'Something went wrong.';
      toast.error('Could not create account', detail);
      throw err;
    }
  }

  async function handleUpdateUser(
    id: number,
    data: { firstName: string; lastName: string; email: string; role: string },
  ) {
    try {
      const updated = await updateUser(id, data);
      toast.success('Member updated', `${updated.firstName} ${updated.lastName} saved.`);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (err: unknown) {
      const detail = err instanceof ApiError && err.errors?.length
        ? err.errors.join('; ')
        : err instanceof Error ? err.message : 'Something went wrong.';
      toast.error('Could not update member', detail);
      throw err;
    }
  }

  async function syncClerkAfterEdit(
    member: AppUser,
    data: { firstName: string; lastName: string; email: string; role: string },
  ) {
    try {
      const res = await fetch('/api/clerk/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: member.clerkId,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        }),
      });
      const json = await res.json() as { ok?: boolean; skipped?: boolean; error?: string };
      if (!res.ok) {
        toast.error('Clerk sync failed', json.error || 'Local profile saved; Clerk was not updated.');
        return;
      }
      if (!json.skipped) {
        toast.success('Clerk synced', 'Sign-in profile and role were updated in Clerk.');
      }
    } catch {
      toast.error('Clerk sync failed', 'Local profile saved; Clerk was not updated.');
    }
  }

  async function handleConfirmDeleteUser() {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    try {
      await deleteUser(deleteUserTarget.id);
      toast.success(
        'Member removed',
        `${deleteUserTarget.firstName} ${deleteUserTarget.lastName} was deleted.`,
      );
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserTarget.id));
      setDeleteUserTarget(null);
    } catch (err: unknown) {
      toast.error(
        'Could not delete member',
        err instanceof Error ? err.message : 'Something went wrong.',
      );
    } finally {
      setDeletingUser(false);
    }
  }

  async function handleCreateTaskSafe(data: {
    taskTitle: string;
    taskDescription: string;
    assignedTo: number;
    coAssignees?: number[];
    dependsOnTaskIds?: number[];
    priority: string;
    dueDate?: string;
  }) {
    try {
      await handleCreateTask(data);
    } catch (err: unknown) {
      toast.error(
        'Could not create task',
        err instanceof Error ? err.message : 'Something went wrong.',
      );
      throw err;
    }
  }

  const resolvedCount  = tasks.filter((t) => t.status === 'resolved').length;
  const visibleUsers   = callerRole === 'admin' ? users : users.filter((u) => u.role === 'employee');
  const assignableUsers = users.filter((u) => u.role === 'employee');

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter   !== 'all' && t.status   !== statusFilter)   return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (dueFilter === 'none') {
      if (t.dueDate) return false;
    } else if (dueFilter !== 'all') {
      const urgency = getDueUrgency(t.dueDate, t.status);
      if (dueFilter === 'soon') {
        if (urgency !== 'soon' && urgency !== 'today') return false;
      } else if (urgency !== dueFilter) {
        return false;
      }
    }
    return true;
  });
  const sortedTasks = sortTasks(filteredTasks, sortField, sortDir);

  const overdueCount = tasks.filter((t) => getDueUrgency(t.dueDate, t.status) === 'overdue').length;
  const dueSoonCount = tasks.filter((t) => {
    const u = getDueUrgency(t.dueDate, t.status);
    return u === 'soon' || u === 'today';
  }).length;

  const STATS = [
    { s: 'all',         label: 'Total',       value: tasks.length },
    { s: 'created',     label: 'Created',     value: tasks.filter((t) => t.status === 'created').length },
    { s: 'assigned',    label: 'Assigned',    value: tasks.filter((t) => t.status === 'assigned').length },
    { s: 'in_progress',      label: 'In Progress',      value: tasks.filter((t) => t.status === 'in_progress').length },
    { s: 'pending_approval', label: 'Pending approval', value: tasks.filter((t) => t.status === 'pending_approval').length },
    { s: 'resolved',         label: 'Resolved',         value: resolvedCount },
    { s: 'done',             label: 'Done',             value: tasks.filter((t) => t.status === 'done').length },
  ] as const;

  const headerActions = (
    <div className="flex gap-2">
      <button
        onClick={() => setCreateUserOpen(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="5.5" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M1 12c0-2.2 2-4 4.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M10 8v4M8 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        New Account
      </button>
      <button
        onClick={() => setCreateTaskOpen(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-medium text-white transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        New Task
      </button>
    </div>
  );

  return (
    <DashboardLayout
      role={callerRole}
      userName={userName}
      userEmail={userEmail}
      pageTitle={callerRole === 'admin' ? 'Admin Dashboard' : 'Supervisor Dashboard'}
      actions={headerActions}
      notificationsEnabled={ready}
      onNotificationTask={(taskId) => router.push(`/supervisor/tasks/${taskId}`)}
    >
      <div className="space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {STATS.map(({ s, label, value }) => (
            <StatCard
              key={s}
              label={label}
              value={value}
              active={tab === 'tasks' && statusFilter === s && dueFilter === 'all'}
              onClick={() => { setTab('tasks'); setStatusFilter(s); setDueFilter('all'); }}
            />
          ))}
          <StatCard
            label="Overdue"
            value={overdueCount}
            active={tab === 'tasks' && dueFilter === 'overdue'}
            onClick={() => {
              setTab('tasks');
              setDueFilter(dueFilter === 'overdue' ? 'all' : 'overdue');
            }}
          />
          <StatCard
            label="Due soon"
            value={dueSoonCount}
            active={tab === 'tasks' && dueFilter === 'soon'}
            onClick={() => {
              setTab('tasks');
              setDueFilter(dueFilter === 'soon' ? 'all' : 'soon');
            }}
          />
        </div>

        {/* Resolved alert */}
        {resolvedCount > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L14 13H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M8 6.5v3M8 11.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium flex-1">
              <strong>{resolvedCount}</strong> task{resolvedCount > 1 ? 's are' : ' is'} waiting for your confirmation.
            </p>
            <button
              onClick={() => { setTab('tasks'); setStatusFilter('resolved'); }}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap"
            >
              Review now
            </button>
          </div>
        )}

        {overdueCount > 0 && dueFilter !== 'overdue' && (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="text-sm text-red-800 dark:text-red-300 font-medium flex-1">
              <strong>{overdueCount}</strong> open task{overdueCount > 1 ? 's are' : ' is'} past due.
            </p>
            <button
              onClick={() => { setTab('tasks'); setDueFilter('overdue'); }}
              className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline whitespace-nowrap"
            >
              View overdue
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-[var(--border)]">
          {([
            { key: 'tasks', label: 'Tasks' },
            { key: 'users', label: `Team (${visibleUsers.length})` },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === key
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tasks tab ── */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            <TaskFilters
              status={statusFilter}
              priority={priorityFilter}
              dueFilter={dueFilter}
              sortField={sortField}
              sortDir={sortDir}
              viewMode={viewMode}
              onStatus={setStatusFilter}
              onPriority={setPriorityFilter}
              onDueFilter={setDueFilter}
              onSort={(f, d) => { setSortField(f); setSortDir(d); }}
              onViewMode={setViewMode}
            />

            {viewMode === 'table' ? (
              <TaskTable
                tasks={sortedTasks}
                users={users}
                loading={loading}
                sortField={sortField}
                sortDir={sortDir}
                role={callerRole}
                busyTaskId={busyTaskId}
                onSort={(f, d) => { setSortField(f); setSortDir(d); }}
                onRowClick={(task) => router.push(`/supervisor/tasks/${task.taskId}`)}
                onConfirmDone={handleConfirmDone}
                onReject={setRejectTaskTarget}
                onReAssign={(task) => {
                  setReAssignTask(task);
                  setReAssignTo(task.assignedTo);
                  setReAssignCos(
                    (task.assignees ?? [])
                      .filter((a) => a.role !== 'LEAD' && a.userId !== task.assignedTo)
                      .map((a) => a.userId),
                  );
                }}
                onStatusUp={handleStatusUp}
                emptyAction={
                  <button
                    onClick={() => setCreateTaskOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] active:scale-95 transition-transform animate-cta-pulse"
                  >
                    Create Task
                  </button>
                }
              />
            ) : (
              <TaskKanban
                tasks={sortedTasks}
                users={users}
                loading={loading}
                role={callerRole}
                busyTaskId={busyTaskId}
                onOpen={(task) => router.push(`/supervisor/tasks/${task.taskId}`)}
                onConfirmDone={handleConfirmDone}
                onReject={setRejectTaskTarget}
                onStatusUp={handleStatusUp}
                emptyAction={
                  <button
                    onClick={() => setCreateTaskOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] active:scale-95 transition-transform animate-cta-pulse"
                  >
                    Create Task
                  </button>
                }
              />
            )}
          </div>
        )}

        {/* ── Users tab ── */}
        {tab === 'users' && (
          <UserTable
            users={visibleUsers}
            loading={usersLoading}
            onView={(user) => router.push(`/supervisor/users/${user.id}`)}
            onEdit={setEditUser}
            onDelete={setDeleteUserTarget}
            emptyAction={
              <button
                onClick={() => setCreateUserOpen(true)}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
              >
                Create Account
              </button>
            }
          />
        )}
      </div>

      {/* ── Modals ── */}

      <RejectTaskModal
        task={rejectTaskTarget}
        open={rejectTaskTarget != null}
        busy={rejecting}
        onClose={() => setRejectTaskTarget(null)}
        onConfirm={handleRejectTask}
      />

      <CreateTaskModal
        open={createTaskOpen}
        users={assignableUsers}
        tasks={tasks}
        onClose={() => setCreateTaskOpen(false)}
        onSubmit={handleCreateTaskSafe}
      />

      <CreateUserModal
        open={createUserOpen}
        callerRole={callerRole}
        onClose={() => setCreateUserOpen(false)}
        onSubmit={handleCreateUser}
      />

      <EditUserModal
        open={!!editUser}
        user={editUser}
        callerRole={callerRole}
        onClose={() => setEditUser(null)}
        onSubmit={handleUpdateUser}
        onAfterSave={syncClerkAfterEdit}
      />

      <Modal
        open={!!deleteUserTarget}
        onClose={() => !deletingUser && setDeleteUserTarget(null)}
        title="Delete Team Member"
        description={
          deleteUserTarget
            ? `Remove ${deleteUserTarget.firstName} ${deleteUserTarget.lastName} (${deleteUserTarget.email}) from the team? This cannot be undone.`
            : undefined
        }
        size="sm"
      >
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={deletingUser}
            onClick={() => setDeleteUserTarget(null)}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deletingUser}
            onClick={() => void handleConfirmDeleteUser()}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {deletingUser && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="32" strokeDashoffset="32" strokeLinecap="round"/>
              </svg>
            )}
            {deletingUser ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>

      {/* Reassign modal */}
      <Modal
        open={!!reAssignTask}
        onClose={() => setReAssignTask(null)}
        title="Reassign Task"
        description={`Update the lead and co-assignees for "${reAssignTask?.taskTitle ?? ''}".`}
        size="sm"
      >
        <form onSubmit={handleReAssign} className="space-y-5">
          <div>
            <label htmlFor="ra-user" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Primary lead <span className="text-red-500">*</span>
            </label>
            <UserSelect
              id="ra-user"
              name="reAssignTo"
              users={assignableUsers}
              value={reAssignTo}
              onChange={(id) => {
                setReAssignTo(id);
                setReAssignCos((prev) => prev.filter((c) => c !== id));
              }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Co-assignees
            </label>
            <MultiUserSelect
              users={assignableUsers}
              value={reAssignCos}
              onChange={setReAssignCos}
              excludeIds={typeof reAssignTo === 'number' ? [reAssignTo] : []}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setReAssignTask(null)}
              className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reAssigning || !reAssignTo}
              className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-2"
            >
              {reAssigning && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                    strokeDasharray="32" strokeDashoffset="32" strokeLinecap="round"/>
                </svg>
              )}
              {reAssigning ? 'Assigning…' : 'Save team'}
            </button>
          </div>
        </form>
      </Modal>

    </DashboardLayout>
  );
}
