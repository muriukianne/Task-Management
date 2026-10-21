import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { assertSupervisorClerkScope, requirePrivileged } from '../clerk-guard';

function tempPassword(): string {
  // Clerk requires strong passwords; include upper/lower/digit/symbol
  return `Tm!${randomBytes(6).toString('base64url')}9a`;
}

/**
 * Privileged: set a temporary password on a linked Clerk user.
 * Body: { clerkId }
 * Returns { temporaryPassword } once — share securely with the user.
 *
 * Supervisors may only reset employee accounts (not themselves, not privileged
 * users). Admins retain full privilege control.
 */
export async function POST(req: Request) {
  const gate = await requirePrivileged();
  if ('error' in gate) return gate.error;

  let body: { clerkId?: string | null };
  try {
    body = await req.json() as { clerkId?: string | null };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.clerkId) {
    return NextResponse.json(
      { error: 'This member has not signed in with Clerk yet. Ask them to accept the invite first.' },
      { status: 400 },
    );
  }

  const denied = await assertSupervisorClerkScope({
    callerUserId: gate.userId,
    callerRole: gate.role,
    targetClerkId: body.clerkId,
  });
  if (denied) return denied;

  const password = tempPassword();
  try {
    const client = await clerkClient();
    await client.users.updateUser(body.clerkId, {
      password,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not reset Clerk password';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    temporaryPassword: password,
    message: 'Temporary password set. Share it securely — it will not be shown again.',
  });
}
