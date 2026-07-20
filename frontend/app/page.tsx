'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { syncUser } from './lib/api';
import { getUserRoleFromToken } from './lib/auth';

export default function Home() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoaded || redirecting) return;

    async function routeByRole() {
      if (!isSignedIn) {
        router.replace('/login');
        return;
      }
      setRedirecting(true);

      // Prefer app_users role (seeded by supervisors) over a bare JWT claim.
      let role: string | null = null;
      try {
        const me = await syncUser();
        role = me.role;
      } catch {
        const token = await getToken({ template: 'quarkus' });
        role = getUserRoleFromToken(token);
      }

      if (role === 'supervisor' || role === 'admin') {
        router.replace('/supervisor');
      } else {
        router.replace('/employee');
      }
    }

    void routeByRole();
  }, [isLoaded, isSignedIn, getToken, router, redirecting]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <p className="text-[var(--text-muted)] text-sm">Redirecting…</p>
    </div>
  );
}
