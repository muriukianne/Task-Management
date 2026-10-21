'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { syncUser, updateOwnProfile, ApiError } from '../lib/api';
import type { UserRole } from '../lib/api';
import { getUserRoleFromToken } from '../lib/auth';
import { useToast } from '../components/providers/ToastContext';
import DashboardLayout from '../components/layout/DashboardLayout';

const INPUT = [
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)]',
  'px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
].join(' ');

const LABEL = 'block text-sm font-medium text-[var(--text-primary)] mb-1.5';

export default function AccountPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<UserRole>('employee');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!isLoaded || !clerkLoaded) return;
    if (!isSignedIn) {
      router.replace('/login');
      return;
    }

    async function init() {
      const token = await getToken({ template: 'quarkus' });
      let nextRole = (getUserRoleFromToken(token) as UserRole) || 'employee';
      try {
        const me = await syncUser({
          email: clerkUser?.primaryEmailAddress?.emailAddress
            ?? clerkUser?.emailAddresses?.[0]?.emailAddress,
          firstName: clerkUser?.firstName ?? undefined,
          lastName: clerkUser?.lastName ?? undefined,
        });
        nextRole = me.role as UserRole;
        setFirstName(me.firstName || clerkUser?.firstName || '');
        setLastName(me.lastName || clerkUser?.lastName || '');
        const clerkEmail =
          clerkUser?.primaryEmailAddress?.emailAddress
          ?? clerkUser?.emailAddresses?.[0]?.emailAddress
          ?? '';
        setEmail(me.email?.endsWith('@local') ? (clerkEmail || '') : me.email);
        setUserName(
          (me.firstName && me.firstName !== 'User'
            ? `${me.firstName} ${me.lastName || ''}`.trim()
            : null)
          || clerkUser?.fullName
          || me.email,
        );
        setUserEmail(me.email?.endsWith('@local') ? (clerkEmail || me.email) : me.email);
      } catch {
        setFirstName(clerkUser?.firstName ?? '');
        setLastName(clerkUser?.lastName ?? '');
        setEmail(clerkUser?.primaryEmailAddress?.emailAddress ?? '');
        setUserName(clerkUser?.fullName ?? 'Account');
        setUserEmail(clerkUser?.primaryEmailAddress?.emailAddress ?? '');
      }
      setRole(nextRole);
      setReady(true);
    }

    void init();
  }, [isLoaded, isSignedIn, clerkLoaded, clerkUser, getToken, router]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      // Re-sync with Clerk email first so orphan → invite merge can run before save
      const clerkEmail =
        clerkUser?.primaryEmailAddress?.emailAddress
        ?? clerkUser?.emailAddresses?.[0]?.emailAddress;
      await syncUser({
        email: email.trim() || clerkEmail,
        firstName: firstName.trim() || clerkUser?.firstName || undefined,
        lastName: lastName.trim() || clerkUser?.lastName || undefined,
      });

      const updated = await updateOwnProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      });

      // Keep Clerk profile in sync for the signed-in user
      if (clerkUser) {
        try {
          await clerkUser.update({
            firstName: updated.firstName,
            lastName: updated.lastName,
          });
        } catch {
          // Local DB updated; Clerk name sync is best-effort
        }
      }

      setUserName(`${updated.firstName} ${updated.lastName}`.trim());
      setUserEmail(updated.email);
      toast.success('Profile updated', 'Your account details were saved. Refresh My Tasks if assignments were missing.');
    } catch (err) {
      toast.error(
        'Could not update profile',
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Something went wrong.',
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!clerkUser) {
      toast.error('Not available', 'Sign in with Clerk to change your password.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mismatch', 'New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await clerkUser.updatePassword({
        currentPassword,
        newPassword,
        signOutOfOtherSessions: true,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated', 'Your password was changed successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not change password.';
      toast.error('Password change failed', message);
    } finally {
      setSavingPassword(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const homeHref = role === 'employee' ? '/employee' : '/supervisor';

  return (
    <DashboardLayout
      role={role}
      userName={userName}
      userEmail={userEmail}
      pageTitle="Account"
      notificationsEnabled={ready}
      onNotificationTask={(id) => router.push(
        role === 'employee' ? `/employee/tasks/${id}` : `/supervisor/tasks/${id}`,
      )}
      actions={
        <button
          type="button"
          onClick={() => router.push(homeHref)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
        >
          ← Back
        </button>
      }
    >
      <div className="max-w-xl mx-auto space-y-8">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Profile</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Update your name and email used across TaskFlow.
            </p>
          </div>
          <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="acc-first" className={LABEL}>First name</label>
                <input
                  id="acc-first"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="acc-last" className={LABEL}>Last name</label>
                <input
                  id="acc-last"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
            <div>
              <label htmlFor="acc-email" className={LABEL}>Email</label>
              <input
                id="acc-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-50"
              >
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Password</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Change the password for your Clerk sign-in. Other sessions will be signed out.
            </p>
          </div>
          <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4">
            <div>
              <label htmlFor="acc-current" className={LABEL}>Current password</label>
              <input
                id="acc-current"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="acc-new" className={LABEL}>New password</label>
              <input
                id="acc-new"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="acc-confirm" className={LABEL}>Confirm new password</label>
              <input
                id="acc-confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-50"
              >
                {savingPassword ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </DashboardLayout>
  );
}
