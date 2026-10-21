'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { syncUser } from './lib/api';
import { getUserRoleFromToken } from './lib/auth';

export default function Home() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser, isLoaded: clerkUserLoaded } = useUser();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!isLoaded || !clerkUserLoaded || redirecting) return;

    async function routeByRole() {
      if (!isSignedIn) {
        router.replace('/login');
        return;
      }
      setRedirecting(true);

      // Prefer app_users role (seeded by supervisors) over a bare JWT claim.
      // Always pass Clerk profile email so invite rows are linked (not orphan @local).
      let role: string | null = null;
      try {
        const me = await syncUser({
          email: clerkUser?.primaryEmailAddress?.emailAddress
            ?? clerkUser?.emailAddresses?.[0]?.emailAddress,
          firstName: clerkUser?.firstName ?? undefined,
          lastName: clerkUser?.lastName ?? undefined,
        });
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
  }, [isLoaded, isSignedIn, clerkUserLoaded, clerkUser, getToken, router, redirecting]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
