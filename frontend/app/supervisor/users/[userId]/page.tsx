'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { decodeToken, getUserRoleFromToken } from '../../../lib/auth';
import {
  getUser, getTasks, syncUser, updateUser, deleteUser, ApiError,
} from '../../../lib/api';
import type { AppUser, Task, UserRole } from '../../../lib/api';
import { useToast } from '../../../components/providers/ToastContext';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import EditUserModal from '../../../components/users/EditUserModal';
import { RoleBadge, StatusBadge, PriorityBadge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import Modal from '../../../components/ui/Modal';
import EmptyState from '../../../components/ui/EmptyState';

export default function SupervisorUserPage() {
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);
  const router = useRouter();
  const { toast } = useToast();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser();

  const [callerRole, setCallerRole] = useState<UserRole>('supervisor');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [ready, setReady] = useState(false);

  const [member, setMember] = useState<AppUser | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        const fromDb = [me.firstName, me.lastName].filter(Boolean).join(' ').trim();
        const synthetic = !me.email || me.email.endsWith('@local') || me.firstName === 'User';
        setUserName((!synthetic && fromDb) || clerkName || fromDb || me.email.split('@')[0] || 'Supervisor');
        setUserEmail(me.email && !me.email.endsWith('@local') ? me.email : (clerkEmail || me.email));
      } catch {
        const payload = token ? decodeToken(token) : null;
        setUserName(clerkName ?? payload?.full_name ?? 'Supervisor');
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
    if (!Number.isFinite(userId) || userId <= 0) {
      setError('Invalid user id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [u, allTasks] = await Promise.all([
        getUser(userId),
        getTasks({ size: 100 }),
      ]);
      setMember(u);
      setTasks(allTasks.content.filter(
        (t) => t.assignedTo === userId || t.assignedBy === userId,
      ));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load user');
      setMember(null);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function handleUpdate(id: number, data: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  }) {
    try {
      const updated = await updateUser(id, data);
      setMember(updated);
      toast.success('Member updated', `${updated.firstName} ${updated.lastName} saved.`);
    } catch (err) {
      toast.error(
        'Could not update member',
        err instanceof ApiError ? err.message : 'Update failed.',
      );
      throw err;
    }
  }

  async function syncClerkAfterEdit(
    memberRow: AppUser,
    data: { firstName: string; lastName: string; email: string; role: string },
  ) {
    try {
      const res = await fetch('/api/clerk/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: memberRow.clerkId,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        }),
      });
      const json = await res.json() as { ok?: boolean; skipped?: boolean; error?: string };
      if (!res.ok) {
        toast.error('Clerk sync failed', json.error || 'Local profile saved; Clerk was not updated.');
      } else if (!json.skipped) {
        toast.success('Clerk synced', 'Sign-in profile and role were updated in Clerk.');
      }
    } catch {
      toast.error('Clerk sync failed', 'Local profile saved; Clerk was not updated.');
    }
  }

  async function handleDelete() {
    if (!member) return;
    setDeleting(true);
    try {
      await deleteUser(member.id);
      toast.success('Member deleted', `${member.firstName} ${member.lastName} was removed.`);
      router.replace('/supervisor');
    } catch (err) {
      toast.error(
        'Could not delete',
        err instanceof ApiError ? err.message : 'Delete failed.',
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = member
    ? `${member.firstName} ${member.lastName}`.trim() || member.email
    : 'User';

  return (
    <DashboardLayout
      role={callerRole}
      userName={userName}
      userEmail={userEmail}
      pageTitle={displayName}
      notificationsEnabled={ready}
      onNotificationTask={(id) => router.push(`/supervisor/tasks/${id}`)}
      actions={
        <Link
          href="/supervisor"
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
        >
          ← Back to team
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
      ) : loading || !member ? (
        <div className="max-w-3xl mx-auto space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                {member.firstName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-[var(--text-primary)]">{displayName}</h2>
                  <RoleBadge role={member.role} />
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{member.email}</p>
                <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-[var(--text-muted)] uppercase">User ID</dt>
                    <dd className="font-mono text-[var(--text-primary)]">#{member.id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-[var(--text-muted)] uppercase">Clerk</dt>
                    <dd className="text-[var(--text-primary)]">
                      {member.clerkId ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Linked</span>
                      ) : (
                        <span className="text-[var(--warning)]">Invited (not logged in)</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Related tasks ({tasks.length})
              </h3>
            </div>
            {tasks.length === 0 ? (
              <EmptyState
                title="No related tasks"
                description="This member is not assigned to or assigning any tasks yet."
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {tasks.map((t) => (
                  <li key={t.taskId}>
                    <Link
                      href={`/supervisor/tasks/${t.taskId}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {t.taskTitle}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {t.assignedTo === userId ? 'Assignee' : 'Assigner'} · #{t.taskId}
                        </p>
                      </div>
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority ?? 'medium'} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <EditUserModal
        open={editOpen}
        user={member}
        callerRole={callerRole}
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdate}
        onAfterSave={syncClerkAfterEdit}
      />

      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title="Delete member"
        size="sm"
      >
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Delete <strong>{displayName}</strong>? This cannot be undone if they have no linked tasks.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={() => setDeleteOpen(false)}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
