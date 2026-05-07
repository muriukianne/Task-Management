'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn, getUserRole } from './lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    const role = getUserRole();
    if (role === 'supervisor' || role === 'admin') {
      router.replace('/supervisor');
    } else {
      router.replace('/employee');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Redirecting…</p>
    </div>
  );
}
