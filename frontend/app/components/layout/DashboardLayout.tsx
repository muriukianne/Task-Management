'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import type { UserRole } from '../../lib/api';

interface DashboardLayoutProps {
  role: UserRole;
  userName: string;
  userEmail: string;
  pageTitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function DashboardLayout({
  role,
  userName,
  userEmail,
  pageTitle,
  actions,
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

      {/* Main area shifts right based on sidebar width */}
      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        {/* Top header */}
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-6 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)] flex-shrink-0">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
