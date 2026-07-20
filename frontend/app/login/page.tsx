'use client';

import { SignIn, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  // If Clerk already has a valid session, leave /login once — never render
  // <SignIn forceRedirectUrl> while signed-in (that recreates redirect loops).
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--text-muted)]">
          {isSignedIn ? 'Continuing…' : 'Loading…'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      {/* Left panel (decorative, lg+) */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-[var(--accent)] px-10 py-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2.5 9l4.5 4.5L15.5 4.5" stroke="white" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white text-xl font-bold tracking-tight">TaskFlow</span>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white leading-snug">
              Manage tasks,<br />ship faster.
            </h2>
            <p className="mt-3 text-white/70 text-sm leading-relaxed">
              A focused workspace for your whole team — from employees to supervisors.
            </p>
          </div>
        </div>

        <p className="text-white/35 text-xs">© 2026 TaskFlow. All rights reserved.</p>
      </div>

      {/* Clerk SignIn — only when signed out */}
      <div className="flex-1 flex items-center justify-center p-8">
        <SignIn
          routing="hash"
          forceRedirectUrl="/"
          signUpUrl="/login"
          appearance={{
            elements: {
              rootBox: 'w-full max-w-sm',
              card: 'shadow-none border border-[var(--border)] bg-[var(--surface)]',
            },
          }}
        />
      </div>
    </div>
  );
}
