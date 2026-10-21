'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { decodeToken, getUserRoleFromToken } from '../../lib/auth';
import {
  getActivity, getUsers, syncUser, ApiError,
} from '../../lib/api';
import type { ActivityLog, AppUser, UserRole } from '../../lib/api';
import { useToast } from '../../components/providers/ToastContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import AuditTrailTable from '../../components/audit/AuditTrailTable';

const ACTION_FILTERS = [
  { value: 'all', label: 'All actions' },
  { value: 'TASK_CREATED', label: 'Task created' },
  { value: 'TASK_REJECTED', label: 'Task rejected' },
  { value: 'STATUS_CHANGED', label: 'Status changed' },
  { value: 'ASSIGNEE_CHANGED', label: 'Assignee changed' },
  { value: 'FILE_UPLOADED', label: 'File uploaded' },
  { value: 'COMMENT_ADDED', label: 'Comment added' },
  { value: 'USER_CREATED', label: 'User created' },
  { value: 'USER_UPDATED', label: 'User updated' },
  { value: 'USER_DELETED', label: 'User deleted' },
] as const;

const PAGE_SIZE = 50;

export default function AuditTrailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser();

  const [callerRole, setCallerRole] = useState<UserRole>('supervisor');
  const [userName, setUserName]     = useState('');
  const [userEmail, setUserEmail]   = useState('');
  const [ready, setReady]           = useState(false);

  const [logs, setLogs]             = useState<ActivityLog[]>([]);
  const [users, setUsers]           = useState<AppUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [actionFilter, setActionFilter] = useState('all');
  const [actorFilter, setActorFilter]   = useState<number | 'all'>('all');

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

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const activityPromise = getActivity({
        page,
        size: PAGE_SIZE,
        actionType: actionFilter === 'all' ? undefined : actionFilter,
        actorId: actorFilter === 'all' ? undefined : actorFilter,
      });
      const usersPromise = getUsers().catch(() => [] as AppUser[]);
      const [activity, team] = await Promise.all([activityPromise, usersPromise]);
      setLogs(activity.content);
      setTotalPages(activity.totalPages);
      setTotalElements(activity.totalElements);
      if (team.length > 0) setUsers(team);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load audit trail';
      toast.error('Load failed', message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, actorFilter, toast]);

  useEffect(() => {
    if (!ready) return;
    void fetchLogs();
  }, [ready, fetchLogs]);

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
      pageTitle="Audit Trail"
      notificationsEnabled={ready}
      onNotificationTask={(taskId) => router.push(`/supervisor/tasks/${taskId}`)}
      actions={
        <button
          type="button"
          onClick={() => void fetchLogs()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
        >
          Refresh
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)] max-w-2xl">
          Full visibility of task and team actions across all users. Supervisors and admins can filter by actor or action type.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span className="sr-only">Filter by action</span>
            <select
              value={actionFilter}
              onChange={(e) => {
                setPage(0);
                setActionFilter(e.target.value);
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              {ACTION_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span className="sr-only">Filter by actor</span>
            <select
              value={actorFilter === 'all' ? 'all' : String(actorFilter)}
              onChange={(e) => {
                setPage(0);
                setActorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value));
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] min-w-[12rem]"
            >
              <option value="all">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.role})
                </option>
              ))}
            </select>
          </label>

          <span className="text-xs text-[var(--text-muted)] ml-auto">
            {totalElements} event{totalElements === 1 ? '' : 's'}
          </span>
        </div>

        <AuditTrailTable logs={logs} loading={loading} />

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={page <= 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--surface-2)]"
            >
              Previous
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--surface-2)]"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
