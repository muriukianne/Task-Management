import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  assertSupervisorClerkScope,
  isAllowedRole,
  normalizeRole,
  requirePrivileged,
} from '../clerk-guard';

/**
 * Sync local app_users edits into Clerk (name + publicMetadata.role).
 * Body: { clerkId, firstName, lastName, role }
 *
 * Supervisors may only update employee accounts (not themselves, not privileged
 * users, and not to supervisor/admin). Admins retain full privilege control.
 */
export async function POST(req: Request) {
  const gate = await requirePrivileged();
  if ('error' in gate) return gate.error;

  let body: {
    clerkId?: string | null;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.clerkId) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: 'User has not linked a Clerk account yet — local profile only.',
    });
  }

  const requestedRole = normalizeRole(body.role);
  if (!isAllowedRole(requestedRole)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const denied = await assertSupervisorClerkScope({
    callerUserId: gate.userId,
    callerRole: gate.role,
    targetClerkId: body.clerkId,
    requestedRole,
  });
  if (denied) return denied;

  try {
    const client = await clerkClient();
    await client.users.updateUser(body.clerkId, {
      firstName: body.firstName?.trim() || undefined,
      lastName: body.lastName?.trim() || undefined,
      publicMetadata: {
        role: requestedRole,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update Clerk user';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
