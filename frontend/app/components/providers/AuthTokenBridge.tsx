'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setTokenProvider } from '../../lib/api';

/**
 * Pushes Clerk's "quarkus" JWT template into the shared API token provider
 * so every Quarkus request gets Authorization: Bearer <token>.
 */
export default function AuthTokenBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    setTokenProvider(async () => {
      if (!isSignedIn) return null;
      try {
        return await getToken({ template: 'quarkus' });
      } catch {
        // Fall back to the default session JWT if the custom template is unavailable
        try {
          return await getToken();
        } catch {
          return null;
        }
      }
    });
  }, [getToken, isSignedIn]);

  // Keep the tree mounted while Clerk loads to avoid remount/redirect races
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
