'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import type { UserRole } from '../../lib/api';

interface DashboardLayoutProps {
  role: UserRole;
  userName: string;
  userEmail: string;
  pageTitle: string;
  actions?: React.ReactNode;
  /** When set, notification clicks open the related task. */
  onNotificationTask?: (taskId: number) => void;
  /** Gate the bell until auth/sync is ready. */
  notificationsEnabled?: boolean;
  children: React.ReactNode;
}

export default function DashboardLayout({
  role,
  userName,
  userEmail,
  pageTitle,
  actions,
  onNotificationTask,
  notificationsEnabled = true,
  children,
}: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 64 : 256;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Sidebar
        role={role}
        userName={userName}
        userEmail={userEmail}
        collapsed={collapsed}
        onCollapse={setCollapsed}
      />

      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-6 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)] flex-shrink-0">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
          <div className="flex items-center gap-3">
            <NotificationBell
              enabled={notificationsEnabled}
              onOpenTask={onNotificationTask}
            />
            {actions}
          </div>
        </header>

        <main className="flex-1 p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
