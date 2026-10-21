import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const ALLOWED_ROLES = new Set(['admin', 'supervisor', 'employee']);

export function roleFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const role = (meta as Record<string, unknown>).role;
  return typeof role === 'string' ? role.trim().toLowerCase() : null;
}

export function normalizeRole(role: string | null | undefined): string {
  return (role ?? 'employee').trim().toLowerCase();
}

export function isPrivilegedRole(role: string): boolean {
  return role === 'admin' || role === 'supervisor';
}

export function isAllowedRole(role: string): boolean {
  return ALLOWED_ROLES.has(role);
}

export async function requirePrivileged(): Promise<
  | { error: NextResponse }
  | { userId: string; role: string }
> {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const me = await currentUser();
  const role =
    roleFromMeta(me?.publicMetadata) ??
    roleFromMeta(me?.privateMetadata) ??
    'employee';
  if (!isPrivilegedRole(role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { userId, role };
}

/**
 * Supervisors may only manage employee Clerk accounts — never their own,
 * never other privileged users, and never assign supervisor/admin.
 * Admins have full privilege control.
 */
export async function assertSupervisorClerkScope(opts: {
  callerUserId: string;
  callerRole: string;
  targetClerkId: string;
  requestedRole?: string;
}): Promise<NextResponse | null> {
  if (opts.callerRole === 'admin') {
    return null;
  }

  if (opts.callerRole !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (opts.targetClerkId === opts.callerUserId) {
    return NextResponse.json(
      { error: 'Supervisors cannot modify their own Clerk account' },
      { status: 403 },
    );
  }

  if (opts.requestedRole != null) {
    const requested = normalizeRole(opts.requestedRole);
    if (requested !== 'employee') {
      return NextResponse.json(
        { error: 'Supervisors can only assign the employee role' },
        { status: 403 },
      );
    }
  }

  const client = await clerkClient();
  try {
    const target = await client.users.getUser(opts.targetClerkId);
    const targetRole =
      roleFromMeta(target.publicMetadata) ??
      roleFromMeta(target.privateMetadata) ??
      'employee';
    if (isPrivilegedRole(targetRole)) {
      return NextResponse.json(
        { error: 'Supervisors can only manage employee accounts' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Clerk user not found' }, { status: 404 });
  }

  return null;
}
