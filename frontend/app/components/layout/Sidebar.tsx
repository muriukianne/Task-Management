'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import type { UserRole } from '../../lib/api';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  {
    href: '/supervisor',
    label: 'Dashboard',
    roles: ['admin', 'supervisor'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/employee',
    label: 'My Tasks',
    roles: ['employee'],
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 5h12M3 9h8M3 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

interface SidebarProps {
  role: UserRole;
  userName: string;
  userEmail: string;
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
}

function ThemeToggle() {
  function toggle() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('tm_theme', isDark ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
    >
      {/* Sun */}
      <svg className="dark:hidden" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.06 1.06M11.84 11.84l1.06 1.06M3.1 12.9l1.06-1.06M11.84 4.16l1.06-1.06"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      {/* Moon */}
      <svg className="hidden dark:block" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M13.5 10A6 6 0 016 2.5a6 6 0 100 11 6 6 0 007.5-3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  );
}

export default function Sidebar({
  role,
  userName,
  userEmail,
  collapsed,
  onCollapse,
}: SidebarProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const { signOut } = useClerk();

  const navItems = NAV.filter((n) => n.roles.includes(role));

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40 flex flex-col bg-[var(--surface)] border-r border-[var(--border)]',
        'transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      ].join(' ')}
    >
      {/* Logo row */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--border)] flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7l3.5 3.5L12 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold text-[var(--text-primary)] tracking-tight">TaskFlow</span>
          </div>
        )}
        <button
          onClick={() => onCollapse(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors ml-auto"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            {collapsed
              ? <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M11 7H3M7 3L3 7l4 4"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            }
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom controls */}
      <div className="px-2 py-3 border-t border-[var(--border)] space-y-1 flex-shrink-0">
        <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'} mb-1`}>
          <ThemeToggle />
        </div>

        {/* User profile */}
        <div
          className={[
            'flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--surface-2)]',
            collapsed ? 'justify-center' : '',
          ].join(' ')}
        >
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{userName}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{userEmail}</p>
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={() => void handleSignOut()}
          title={collapsed ? 'Sign out' : undefined}
          className={[
            'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium',
            'text-[var(--text-secondary)] hover:bg-red-50 hover:text-red-600',
            'dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors',
            collapsed ? 'justify-center' : '',
          ].join(' ')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 5l3 3-3 3M13 8H6"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
