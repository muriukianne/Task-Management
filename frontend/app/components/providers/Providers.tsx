'use client';

import { ToastProvider } from './ToastContext';
import AuthTokenBridge from './AuthTokenBridge';
import ToastContainer from '../ui/Toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthTokenBridge>
        {children}
      </AuthTokenBridge>
      <ToastContainer />
    </ToastProvider>
  );
}
