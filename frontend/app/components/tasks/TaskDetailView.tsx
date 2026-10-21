'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { Task, AppUser, TaskComment } from '../../lib/api';
import { getTaskComments, addTaskComment, ApiError } from '../../lib/api';
import { StatusBadge, PriorityBadge, RoleBadge, DueBadge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import TaskDocuments from './TaskDocuments';
import TaskDependenciesPanel from './TaskDependenciesPanel';
import { formatDueLong, getDueUrgency } from '../../lib/dueDate';

export interface TaskDetailViewProps {
  task: Task | null;
  users: AppUser[];
  /** All tasks for dependency picker / tree links (optional). */
  allTasks?: Task[];
  loading: boolean;
  role: string;
  currentUserId?: number | null;
  /** When false, comments are not loaded (e.g. closed modal). Default true. */
  active?: boolean;
  busy?: boolean;
  /** Link assignee/assigner to profile (supervisor/admin). */
  userProfileBase?: string | null;
  /** Link to other tasks in the dependency tree. */
  taskBasePath?: string;
  onConfirmDone: (task: Task) => void;
  onReject?: (task: Task, reason: string) => Promise<void> | void;
  onReAssign: (task: Task) => void;
  onStatusUp: (task: Task, status: string) => void;
  /** Called after successful reject when parent should navigate away. */
  onAfterReject?: () => void;
  onAfterConfirmDone?: () => void;
  /** Called when documents change so parent can refresh task metadata. */
  onDocumentsChanged?: () => void;
  /** Called when dependencies change. */
  onDependenciesChanged?: () => void;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T')).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function displayUser(users: AppUser[], id: number | undefined, fallback: string) {
  if (id == null) return '—';
  const u = users.find((x) => x.id === id);
  if (u) return `${u.firstName} ${u.lastName}`.trim() || u.email;
  return fallback;
}

/** Prefer enriched assignee fields from the API (works when `users` list is incomplete). */
function assigneeDisplay(
  a: { userId: number; firstName?: string | null; lastName?: string | null; email?: string | null },
  users: AppUser[],
) {
  const fromApi = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
  const fromUsers = displayUser(users, a.userId, '');
  const name = fromApi || fromUsers || (a.email ? a.email.split('@')[0] : '') || `User #${a.userId}`;
  const email = a.email
    || users.find((u) => u.id === a.userId)?.email
    || null;
  return { name, email };
}

function AssigneeIdentity({
  a,
  users,
  userLabel,
  isYou,
}: {
  a: { userId: number; firstName?: string | null; lastName?: string | null; email?: string | null };
  users: AppUser[];
  userLabel: (id: number | undefined, name: string) => ReactNode;
  isYou?: boolean;
}) {
  const { name, email } = assigneeDisplay(a, users);
  return (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5 flex-wrap">
        {userLabel(a.userId, name)}
        {isYou && <span className="text-[10px] text-[var(--text-muted)]">(you)</span>}
      </span>
      {email && (
        <span className="block text-xs text-[var(--text-muted)] truncate">{email}</span>
      )}
    </span>
  );
}

export default function TaskDetailView({
  task,
  users,
  allTasks = [],
  loading,
  role,
  currentUserId = null,
  active = true,
  busy = false,
  userProfileBase = null,
  taskBasePath = '/supervisor/tasks',
  onConfirmDone,
  onReject,
  onReAssign,
  onStatusUp,
  onAfterReject,
  onAfterConfirmDone,
  onDocumentsChanged,
  onDependenciesChanged,
}: TaskDetailViewProps) {
  const isPrivileged = role === 'supervisor' || role === 'admin';
  const canComment = Boolean(task);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState('');

  const assignerName = displayUser(
    users,
    task?.assignedBy,
    role === 'employee' ? 'Supervisor' : (task ? `#${task.assignedBy}` : '—'),
  );

  useEffect(() => {
    if (!active || !task) {
      setComments([]);
      setCommentDraft('');
      setCommentError('');
      setRejectOpen(false);
      setRejectReason('');
      setRejectError('');
      return;
    }

    let cancelled = false;
    setCommentsLoading(true);
    void getTaskComments(task.taskId)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });

    return () => { cancelled = true; };
  }, [active, task?.taskId]);

  async function handleRejectSubmit() {
    if (!task || !onReject) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      setRejectError('Please provide at least 3 characters explaining the rejection.');
      return;
    }
    setRejecting(true);
    setRejectError('');
    try {
      await onReject(task, reason);
      setRejectOpen(false);
      setRejectReason('');
      onAfterReject?.();
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setRejecting(false);
    }
  }

  async function handleAddComment() {
    if (!task) return;
    const body = commentDraft.trim();
    if (!body) {
      setCommentError('Comment cannot be empty.');
      return;
    }
    setCommentBusy(true);
    setCommentError('');
    try {
      const created = await addTaskComment(task.taskId, body);
      setComments((prev) => [...prev, created]);
      setCommentDraft('');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not post comment';
      setCommentError(message);
    } finally {
      setCommentBusy(false);
    }
  }

  function userLabel(id: number | undefined, name: string) {
    if (id == null || !userProfileBase || !isPrivileged) return name;
    return (
      <Link
        href={`${userProfileBase}/${id}`}
        className="text-[var(--accent)] hover:underline font-medium"
      >
        {name}
      </Link>
    );
  }

  if (loading || !task) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid grid-cols-2 gap-4 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority ?? 'medium'} />
        {task.blocked && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Blocked by dependencies
          </span>
        )}
        {task.attachedFile && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            📎 Has attachment
          </span>
        )}
      </div>

      <div className="rounded-xl bg-[var(--surface-2)] px-4 py-3">
        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
          {task.taskDescription || 'No description provided.'}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <InfoRow label="Task ID" value={`#${task.taskId}`} />
        <InfoRow label="Assigned by" value={userLabel(task.assignedBy, assignerName)} />
        <InfoRow
          label="Due date"
          value={<DueDateValue dueDate={task.dueDate} status={task.status} />}
        />
        <InfoRow label="Created" value={fmt(task.createdAt)} />
        <InfoRow label="Last updated" value={fmt(task.updatedAt)} />
      </dl>

      <div>
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
          {task.viewerAssigneeRole === 'LEAD'
            ? 'Your team'
            : task.viewerAssigneeRole === 'CO_ASSIGNEE'
              ? 'Your team lead'
              : 'Team'}
        </p>
        {(() => {
          const list = task.assignees && task.assignees.length > 0
            ? task.assignees
            : [{
                userId: task.assignedTo,
                role: 'LEAD' as const,
                firstName: null,
                lastName: null,
                email: null,
              }];
          const lead = list.find((a) => a.role === 'LEAD') ?? list[0];
          const cos = list.filter((a) => a.role !== 'LEAD');
          const isLeadView = task.viewerAssigneeRole === 'LEAD';
          const isCoView = task.viewerAssigneeRole === 'CO_ASSIGNEE';

          return (
            <div className="space-y-3">
              {(isCoView || !isLeadView) && lead && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                    Team lead
                  </p>
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)] mt-0.5">
                      Lead
                    </span>
                    <AssigneeIdentity
                      a={lead}
                      users={users}
                      userLabel={userLabel}
                      isYou={currentUserId === lead.userId}
                    />
                  </div>
                </div>
              )}

              {(isLeadView || (!isCoView && cos.length > 0)) && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                    {isLeadView ? 'Co-assignees under you' : 'Co-assignees'}
                  </p>
                  {cos.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">No co-assignees on this task.</p>
                  ) : (
                    <ul className="space-y-2">
                      {cos.map((a) => (
                        <li key={a.userId} className="flex items-start gap-2 text-sm">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] mt-0.5">
                            Co
                          </span>
                          <AssigneeIdentity
                            a={a}
                            users={users}
                            userLabel={userLabel}
                            isYou={currentUserId === a.userId}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {isLeadView && (
                <div className="flex items-center gap-2 text-sm px-0.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)]">
                    Lead
                  </span>
                  <span className="text-[var(--text-secondary)]">You are the team lead</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {task.status === 'pending_approval' && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 px-3 py-2.5 text-sm text-orange-800 dark:text-orange-200">
          {task.viewerAssigneeRole === 'LEAD'
            ? 'A co-assignee submitted this work for your approval. Approve to mark resolved, or send it back.'
            : 'Waiting for the team lead to approve this work before it can be resolved.'}
        </div>
      )}

      <TaskDependenciesPanel
        task={task}
        allTasks={allTasks}
        taskBasePath={taskBasePath}
        isPrivileged={isPrivileged}
        onChanged={() => onDependenciesChanged?.()}
      />

      <TaskDocuments
        taskId={task.taskId}
        active={active}
        currentUserId={currentUserId}
        isPrivileged={isPrivileged}
        onChanged={onDocumentsChanged}
      />

      <div className="pt-2 border-t border-[var(--border)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Comments</h3>
          <span className="text-[10px] text-[var(--text-muted)]">
            Visible to assignee & supervisor
          </span>
        </div>

        {commentsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] italic">
            No comments yet. Start the conversation below.
          </p>
        ) : (
          <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {comments.map((c) => {
              const mine = currentUserId != null && c.authorId === currentUserId;
              const isRejection = c.body.startsWith('Rejection:');
              return (
                <li
                  key={c.id}
                  className={[
                    'rounded-xl px-3 py-2.5 border',
                    isRejection
                      ? 'border-orange-300/60 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700/40'
                      : mine
                        ? 'border-[var(--accent)]/40 bg-[var(--accent-subtle)] ml-4'
                        : 'border-[var(--border)] bg-[var(--surface-2)] mr-4',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {mine ? 'You' : (c.authorName ?? `User #${c.authorId}`)}
                    </span>
                    {c.authorRole && <RoleBadge role={c.authorRole} />}
                    <span className="text-[10px] text-[var(--text-muted)] ml-auto">{fmtWhen(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {c.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {canComment && (
          <div className="space-y-2">
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder={
                isPrivileged
                  ? 'Add feedback for the assignee…'
                  : 'Reply to your supervisor…'
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            />
            {commentError && <p className="text-xs text-red-500">{commentError}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={commentBusy || !commentDraft.trim()}
                onClick={() => void handleAddComment()}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {commentBusy ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </div>
        )}
      </div>

      {isPrivileged && task.status === 'resolved' && rejectOpen && (
        <div className="rounded-xl border border-orange-300/70 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700/50 p-3 space-y-2">
          <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
            Reject & return to In Progress
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Explain what needs to be fixed…"
            className="w-full rounded-xl border border-orange-200 dark:border-orange-800 bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-orange-400/40"
          />
          {rejectError && <p className="text-xs text-red-500">{rejectError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              disabled={rejecting}
              onClick={() => { setRejectOpen(false); setRejectError(''); }}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={rejecting || rejectReason.trim().length < 3}
              onClick={() => void handleRejectSubmit()}
              className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
            >
              {rejecting ? 'Rejecting…' : 'Confirm rejection'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
        {isPrivileged && task.status === 'resolved' && !rejectOpen && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onConfirmDone(task);
                onAfterConfirmDone?.();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {busy ? 'Updating…' : 'Confirm Done'}
            </button>
            {onReject && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setRejectOpen(true)}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            )}
          </>
        )}
        {isPrivileged && (task.status === 'created' || task.status === 'assigned' || task.status === 'resolved') && (
          <button
            type="button"
            onClick={() => onReAssign(task)}
            className="px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] text-sm font-semibold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            Reassign
          </button>
        )}
        {role === 'employee' && task.status === 'assigned' && (
          <button
            type="button"
            disabled={busy || Boolean(task.blocked)}
            title={task.blocked ? 'Unfinished dependencies block starting this task' : undefined}
            onClick={() => onStatusUp(task, 'in_progress')}
            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {busy ? 'Updating…' : task.blocked ? 'Blocked' : 'Start Working'}
          </button>
        )}
        {role === 'employee' && task.status === 'assigned' && task.blocked && (
          <p className="text-xs text-amber-700 dark:text-amber-300 w-full">
            Resolve blocker tasks first (see Dependencies above).
          </p>
        )}
        {role === 'employee' && task.status === 'in_progress' && task.viewerAssigneeRole === 'CO_ASSIGNEE' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatusUp(task, 'pending_approval')}
            className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {busy ? 'Updating…' : 'Submit for lead approval'}
          </button>
        )}
        {role === 'employee' && task.status === 'in_progress' && task.viewerAssigneeRole !== 'CO_ASSIGNEE' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatusUp(task, 'resolved')}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            {busy ? 'Updating…' : 'Mark as Resolved'}
          </button>
        )}
        {role === 'employee' && task.status === 'pending_approval' && task.viewerAssigneeRole === 'LEAD' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatusUp(task, 'resolved')}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {busy ? 'Updating…' : 'Approve & resolve'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatusUp(task, 'in_progress')}
              className="px-4 py-2 rounded-xl border border-orange-300 text-orange-700 dark:text-orange-300 text-sm font-semibold hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors disabled:opacity-50"
            >
              {busy ? 'Updating…' : 'Send back'}
            </button>
          </>
        )}
        {role === 'employee' && task.status === 'pending_approval' && task.viewerAssigneeRole !== 'LEAD' && (
          <p className="text-sm text-[var(--text-secondary)] italic py-2">
            Awaiting team lead approval.
          </p>
        )}
        {task.status === 'resolved' && role === 'employee' && (
          <p className="text-sm text-[var(--text-secondary)] italic py-2">
            Awaiting supervisor confirmation.
          </p>
        )}
        {task.status === 'done' && (
          <span className="px-4 py-2 rounded-xl bg-[var(--success-subtle)] text-[var(--success)] text-sm font-semibold">
            ✓ Completed
          </span>
        )}
      </div>
    </div>
  );
}

function DueDateValue({
  dueDate,
  status,
}: {
  dueDate: string | null | undefined;
  status?: string | null;
}) {
  if (!dueDate) return '—';
  const urgency = getDueUrgency(dueDate, status);
  const tone =
    urgency === 'overdue'
      ? 'text-red-600 dark:text-red-400 font-semibold'
      : urgency === 'today'
        ? 'text-orange-600 dark:text-orange-400 font-semibold'
        : urgency === 'soon'
          ? 'text-amber-700 dark:text-amber-300 font-semibold'
          : undefined;
  return (
    <span className="inline-flex flex-col gap-1">
      <span className={tone}>{formatDueLong(dueDate)}</span>
      <DueBadge dueDate={dueDate} status={status} showDate={false} />
    </span>
  );
}
