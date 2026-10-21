'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { AppUser, UserRole } from '../../lib/api';
import Modal from '../ui/Modal';

interface EditUserModalProps {
  open:       boolean;
  user:       AppUser | null;
  callerRole: UserRole;
  onClose:    () => void;
  onSubmit:   (id: number, data: {
    firstName: string;
    lastName:  string;
    email:     string;
    role:      string;
  }) => Promise<void>;
  /** After local save, sync name/role into Clerk when linked. */
  onAfterSave?: (user: AppUser, data: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  }) => Promise<void>;
}

const INPUT = [
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)]',
  'px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
  'transition-shadow',
].join(' ');

const LABEL = 'block text-sm font-medium text-[var(--text-primary)] mb-1.5';

export default function EditUserModal({
  open, user, callerRole, onClose, onSubmit, onAfterSave,
}: EditUserModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resetError, setResetError] = useState('');
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [email, setEmail]           = useState('');
  const [role, setRole]             = useState('employee');

  useEffect(() => {
    if (!open || !user) return;
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setEmail(user.email ?? '');
    setRole(user.role ?? 'employee');
    setTempPassword(null);
    setResetError('');
  }, [open, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    const data = {
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.trim().toLowerCase(),
      role,
    };

    setSubmitting(true);
    try {
      await onSubmit(user.id, data);
      if (onAfterSave) {
        await onAfterSave(user, data);
      }
      onClose();
    } catch {
      // Parent shows toast; keep the form open for correction.
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!user?.clerkId) {
      setResetError('This member has not signed in yet. They must accept the Clerk invite first.');
      return;
    }
    setResetting(true);
    setResetError('');
    setTempPassword(null);
    try {
      const res = await fetch('/api/clerk/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkId: user.clerkId }),
      });
      const json = await res.json() as {
        ok?: boolean;
        temporaryPassword?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || 'Could not reset password');
      }
      setTempPassword(json.temporaryPassword ?? null);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setResetting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Team Member"
      description={user ? `Update details for ${user.firstName} ${user.lastName}.` : undefined}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="eu-first" className={LABEL}>
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id="eu-first" required
              minLength={1} maxLength={100}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="eu-last" className={LABEL}>
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              id="eu-last" required
              minLength={1} maxLength={100}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div>
          <label htmlFor="eu-email" className={LABEL}>
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="eu-email" type="email" required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            Stored in TaskFlow. Sign-in email is managed in Clerk for linked accounts.
          </p>
        </div>

        <div>
          <label htmlFor="eu-role" className={LABEL}>Role</label>
          <select
            id="eu-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={INPUT}
            disabled={callerRole !== 'admin'}
          >
            <option value="employee">Employee</option>
            {callerRole === 'admin' && <option value="supervisor">Supervisor</option>}
            {callerRole === 'admin' && <option value="admin">Admin</option>}
          </select>
          {callerRole !== 'admin' && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              Supervisors can only manage employee accounts.
            </p>
          )}
          {callerRole === 'admin' && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              Role is synced to Clerk so it applies on the member&apos;s next sign-in.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">Password reset</p>
          <p className="text-xs text-[var(--text-muted)]">
            {user?.clerkId
              ? 'Generate a temporary password the member can use to sign in, then they should change it under Account.'
              : 'Unavailable until this member links their Clerk account (first login).'}
          </p>
          <button
            type="button"
            disabled={!user?.clerkId || resetting}
            onClick={() => void handleResetPassword()}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 transition-colors"
          >
            {resetting ? 'Resetting…' : 'Reset password'}
          </button>
          {resetError && (
            <p className="text-xs text-red-600 dark:text-red-400">{resetError}</p>
          )}
          {tempPassword && (
            <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Temporary password (copy now)
              </p>
              <code className="text-sm font-mono text-[var(--text-primary)] break-all">
                {tempPassword}
              </code>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button" onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
                  strokeDasharray="32" strokeDashoffset="32" strokeLinecap="round"/>
              </svg>
            )}
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
