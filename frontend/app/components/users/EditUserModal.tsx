'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
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
}

const INPUT = [
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)]',
  'px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
  'transition-shadow',
].join(' ');

const LABEL = 'block text-sm font-medium text-[var(--text-primary)] mb-1.5';

export default function EditUserModal({
  open, user, callerRole, onClose, onSubmit,
}: EditUserModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [email, setEmail]           = useState('');
  const [role, setRole]             = useState('employee');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setRole(user.role);
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      await onSubmit(user.id, {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email:     email.trim(),
        role,
      });
      onClose();
    } catch {
      // Parent shows toast; keep the form open for correction.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Team Member"
      description={user ? `Update details for ${user.firstName} ${user.lastName}.` : undefined}
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
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
