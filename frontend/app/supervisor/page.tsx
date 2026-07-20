'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { decodeToken, getUserRoleFromToken } from '../lib/auth';
import {
  getTasks, getTask, getUsers, createTask, assignTask,
  updateTaskStatus, createUser, updateUser, deleteUser, syncUser, ApiError,
} from '../lib/api';
import type { Task, AppUser, UserRole, TaskStatus } from '../lib/api';
import { useToast } from '../components/providers/ToastContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import TaskFilters from '../components/tasks/TaskFilters';
import TaskTable from '../components/tasks/TaskTable';
import TaskKanban from '../components/tasks/TaskKanban';
import TaskDetail from '../components/tasks/TaskDetail';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import CreateUserModal from '../components/users/CreateUserModal';
import EditUserModal from '../components/users/EditUserModal';
import UserTable from '../components/users/UserTable';
import Modal from '../components/ui/Modal';
import UserSelect from '../components/ui/UserSelect';
import type { SortField, SortDir } from '../components/tasks/TaskFilters';

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
  const [sortField, setSortField]           = useState<SortField>('updatedAt');
  const [sortDir, setSortDir]               = useState<SortDir>('desc');
  const [viewMode, setViewMode]             = useState<'table' | 'kanban'>('table');

  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editUser, setEditUser]             = useState<AppUser | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser]     = useState(false);

  const [detailOpen, setDetailOpen]       = useState(false);
  const [detailTask, setDetailTask]       = useState<Task | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [reAssignTask, setReAssignTask] = useState<Task | null>(null);
  const [reAssignTo, setReAssignTo]     = useState<number | ''>('');
  const [reAssigning, setReAssigning]   = useState(false);

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

    try {
      const taskResult = await getTasks({ size: 100 });
      setTasks(taskResult.content);
    } catch (err: unknown) {
      errors.push(err instanceof Error ? err.message : 'Could not load tasks.');
    } finally {
      setLoading(false);
    }

    try {
      const userResult = await getUsers();
      setUsers(userResult);
    } catch (err: unknown) {
      errors.push(err instanceof Error ? err.message : 'Could not load team.');
    } finally {
      setUsersLoading(false);
    }

    if (errors.length) {
      toast.error('Load failed', errors.join(' '));
    }
  }, [toast]);

  async function handleOpenDetail(task: Task) {
    setDetailTask(task);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const fresh = await getTask(task.taskId);
      setDetailTask(fresh);
    } catch {
      // keep existing data
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleStatusUp(task: Task, newStatus: string) {
    const previous = task;
    const optimistic = { ...task, status: newStatus as TaskStatus };

    setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? optimistic : t)));
    setDetailTask((curr) => (curr?.taskId === task.taskId ? optimistic : curr));

    try {
      const updated = await updateTaskStatus(task.taskId, newStatus);
      toast.success('Status updated', `"${task.taskTitle}" → ${newStatus.replace('_', ' ')}.`);
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? updated : t)));
      setDetailTask((curr) => (curr?.taskId === task.taskId ? updated : curr));
    } catch (err: unknown) {
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? previous : t)));
      setDetailTask((curr) => (curr?.taskId === task.taskId ? previous : curr));
      toast.error('Update failed', err instanceof Error ? err.message : 'Could not update status.');
    }
  }

  async function handleConfirmDone(task: Task) {
    const previous = task;
    const optimistic = { ...task, status: 'done' as TaskStatus };

    setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? optimistic : t)));
    setDetailTask((curr) => (curr?.taskId === task.taskId ? optimistic : curr));

    try {
      const updated = await updateTaskStatus(task.taskId, 'done');
      toast.success('Task completed', `"${task.taskTitle}" marked as done.`);
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? updated : t)));
      setDetailTask((curr) => (curr?.taskId === task.taskId ? updated : curr));
    } catch (err: unknown) {
      setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? previous : t)));
      setDetailTask((curr) => (curr?.taskId === task.taskId ? previous : curr));
      toast.error('Failed', err instanceof Error ? err.message : 'Could not confirm task.');
    }
  }

  async function handleCreateTask(data: {
    taskTitle: string;
    taskDescription: string;
    assignedTo: number;
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
      const updated = await assignTask(reAssignTask.taskId, reAssignTo);
      const member  = users.find((u) => u.id === reAssignTo);
      toast.success('Task reassigned', `Assigned to ${member ? `${member.firstName} ${member.lastName}` : `#${reAssignTo}`}.`);
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
    return true;
  });
  const sortedTasks = sortTasks(filteredTasks, sortField, sortDir);

  const STATS = [
    { s: 'all',         label: 'Total',       value: tasks.length },
    { s: 'created',     label: 'Created',     value: tasks.filter((t) => t.status === 'created').length },
    { s: 'assigned',    label: 'Assigned',    value: tasks.filter((t) => t.status === 'assigned').length },
    { s: 'in_progress', label: 'In Progress', value: tasks.filter((t) => t.status === 'in_progress').length },
    { s: 'resolved',    label: 'Resolved',    value: resolvedCount },
    { s: 'done',        label: 'Done',        value: tasks.filter((t) => t.status === 'done').length },
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
    >
      <div className="space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {STATS.map(({ s, label, value }) => (
            <StatCard
              key={s}
              label={label}
              value={value}
              active={tab === 'tasks' && statusFilter === s}
              onClick={() => { setTab('tasks'); setStatusFilter(s); }}
            />
          ))}
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
              sortField={sortField}
              sortDir={sortDir}
              viewMode={viewMode}
              onStatus={setStatusFilter}
              onPriority={setPriorityFilter}
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
                onSort={(f, d) => { setSortField(f); setSortDir(d); }}
                onRowClick={handleOpenDetail}
                onConfirmDone={handleConfirmDone}
                onReAssign={(task) => { setReAssignTask(task); setReAssignTo(task.assignedTo); }}
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
                onOpen={handleOpenDetail}
                onConfirmDone={handleConfirmDone}
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

      <TaskDetail
        task={detailTask}
        users={users}
        loading={detailLoading}
        role={callerRole}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onConfirmDone={(task) => { handleConfirmDone(task); setDetailOpen(false); }}
        onReAssign={(task) => {
          setReAssignTask(task);
          setReAssignTo(task.assignedTo);
          setDetailOpen(false);
        }}
        onStatusUp={handleStatusUp}
      />

      <CreateTaskModal
        open={createTaskOpen}
        users={assignableUsers}
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
        description={`Reassign "${reAssignTask?.taskTitle ?? ''}" to another team member.`}
        size="sm"
      >
        <form onSubmit={handleReAssign} className="space-y-5">
          <div>
            <label htmlFor="ra-user" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Assign To <span className="text-red-500">*</span>
            </label>
            <UserSelect
              id="ra-user"
              name="reAssignTo"
              users={assignableUsers}
              value={reAssignTo}
              onChange={setReAssignTo}
              required
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
              {reAssigning ? 'Assigning…' : 'Reassign'}
            </button>
          </div>
        </form>
      </Modal>

    </DashboardLayout>
  );
}
