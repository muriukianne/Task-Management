'use client';

import { FormEvent, useRef, useState } from 'react';
import type { UserRole } from '../../lib/api';
import Modal from '../ui/Modal';

interface CreateUserModalProps {
  open:       boolean;
  callerRole: UserRole;
  onClose:    () => void;
  onSubmit:   (data: {
    firstName: string;
    lastName:  string;
    email: string;
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

export default function CreateUserModal({
  open, callerRole, onClose, onSubmit,
}: CreateUserModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);

    const data = {
      firstName: (fd.get('firstName') as string).trim(),
      lastName:  (fd.get('lastName')  as string).trim(),
      email:     (fd.get('email')     as string).trim(),
      role:      fd.get('role') as string,
    };

    setSubmitting(true);
    try {
      await onSubmit(data);
      formRef.current?.reset();
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
      title="Create New Account"
      description="Register a teammate in TaskFlow. They must also have a Clerk login with the same email."
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          Sign-in is handled by Clerk. After creating this account, invite or add the same email
          in your Clerk dashboard so they can log in. Tasks can be assigned as soon as they appear
          under Team.
        </div>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="cu-first" className={LABEL}>
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id="cu-first" name="firstName" required
              minLength={1} maxLength={100}
              placeholder="John"
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="cu-last" className={LABEL}>
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              id="cu-last" name="lastName" required
              minLength={1} maxLength={100}
              placeholder="Doe"
              className={INPUT}
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="cu-email" className={LABEL}>
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="cu-email" name="email" type="email" required
            maxLength={254}
            placeholder="john.doe@company.com"
            className={INPUT}
          />
        </div>

        {/* Role */}
        <div>
          <label htmlFor="cu-role" className={LABEL}>Role</label>
          <select id="cu-role" name="role" defaultValue="employee" className={INPUT}>
            <option value="employee">Employee</option>
            {callerRole === 'admin' && <option value="supervisor">Supervisor</option>}
            {callerRole === 'admin' && <option value="admin">Admin</option>}
          </select>
        </div>

        {/* Footer */}
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
            {submitting ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
